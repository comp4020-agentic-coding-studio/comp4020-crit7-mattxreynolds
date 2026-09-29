import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "./db";
import { publishPostChanged } from "./events";
import { closePendingOffers, hasPendingOffers, pendingOfferCounts } from "./offer-store";
import { type SchoolClass, classes, students, swapPostJoinClasses, swapPosts } from "./schema";

export const MESSAGE_MAX = 500;
// the board shows this many characters of a message, then "…" (0047)
export const BOARD_MESSAGE_CUT = 120;

export interface PostView {
  id: number;
  studentId: number;
  username: string;
  leaving: SchoolClass;
  joins: SchoolClass[];
  message: string | null;
  status: string;
  postedAt: Date;
  editedAt: Date | null;
  withdrawnAt: Date | null;
  // offers still waiting for the poster (0023): the one count everyone sees
  pendingOffers: number;
}

export interface NewPost {
  leavingClassId: string;
  joinClassIds: string[];
  message: string;
}

export type CreatePostResult =
  | { ok: true; postId: number }
  | { ok: false; error: string; existingPostId?: number };

export type EditPostResult =
  | { ok: true }
  | { ok: false; reason: "not-found" | "forbidden" | "not-open" | "locked" | "invalid"; error: string };

export type WithdrawPostResult = { ok: true } | { ok: false; reason: "not-found" | "forbidden" | "not-open"; error: string };

const charCount = (text: string): number => [...text].length;

export function allClasses(): SchoolClass[] {
  return db.select().from(classes).orderBy(classes.position).all();
}

export function openPostIdFor(studentId: number): number | null {
  const row = db
    .select({ id: swapPosts.id })
    .from(swapPosts)
    .where(and(eq(swapPosts.studentId, studentId), eq(swapPosts.status, "open")))
    .get();
  return row?.id ?? null;
}

type CheckedInput = { ok: true; joinClassIds: string[]; message: string } | { ok: false; error: string };

// The rules a post's contents must meet, for a new post and an edit alike
// (0017, 0018): one place, so both refuse with the same message.
function checkInput(input: NewPost): CheckedInput {
  const known = new Set(allClasses().map((c) => c.id));
  if (!known.has(input.leavingClassId)) {
    return { ok: false, error: "Pick the class you are leaving." };
  }
  const joinClassIds = [...new Set(input.joinClassIds)];
  if (joinClassIds.length === 0) {
    return { ok: false, error: "Pick at least one class you would join." };
  }
  if (joinClassIds.some((id) => !known.has(id))) {
    return { ok: false, error: "One of the classes you picked does not exist." };
  }
  if (joinClassIds.includes(input.leavingClassId)) {
    return { ok: false, error: "You can't join the class you are leaving." };
  }
  // browsers send line breaks as CRLF; store and count them as one character
  const message = input.message.replace(/\r\n?/g, "\n");
  if (charCount(message) > MESSAGE_MAX) {
    return { ok: false, error: `Message must be at most ${MESSAGE_MAX} characters.` };
  }

  return { ok: true, joinClassIds, message };
}

// Every rule here is enforced on the server (0017, 0016): the form only makes
// the mistakes hard to make.
export function createPost(studentId: number, input: NewPost): CreatePostResult {
  const existingPostId = openPostIdFor(studentId);
  if (existingPostId !== null) {
    return { ok: false, error: "You already have an open post.", existingPostId };
  }

  const checked = checkInput(input);
  if (!checked.ok) return checked;
  const { joinClassIds, message } = checked;

  let postId: number;
  try {
    postId = db.transaction((tx) => {
      const post = tx
        .insert(swapPosts)
        .values({
          studentId,
          leavingClassId: input.leavingClassId,
          message: message.trim() === "" ? null : message,
          postedAt: new Date(),
        })
        .returning({ id: swapPosts.id })
        .get();
      tx.insert(swapPostJoinClasses)
        .values(joinClassIds.map((classId) => ({ postId: post.id, classId })))
        .run();
      return post.id;
    });
  } catch (error) {
    // two requests from one student can both pass the check above; the
    // partial unique index is the real guard
    if (error instanceof Error && /UNIQUE constraint failed/.test(error.message)) {
      return { ok: false, error: "You already have an open post.", existingPostId: openPostIdFor(studentId) ?? undefined };
    }
    throw error;
  }

  publishPostChanged(postId, "created");
  return { ok: true, postId };
}

const NOT_FOUND = "There is no swap post with that number.";
const NOT_YOURS = "Only the poster can change this swap post.";
const WITHDRAWN = "This swap post was withdrawn.";
export const LOCKED = "This swap post has pending offers, so it can't be edited. Withdraw it to change your mind.";

// The post as a change to it needs to see it: who owns it and whether it is
// still open. Whoever isn't the poster is refused first, so a stranger learns
// nothing else about the post from the reason.
function changeable(studentId: number, postId: number): { ok: true } | { ok: false; reason: "not-found" | "forbidden" | "not-open"; error: string } {
  const row = db.select({ studentId: swapPosts.studentId, status: swapPosts.status }).from(swapPosts).where(eq(swapPosts.id, postId)).get();
  if (!row) return { ok: false, reason: "not-found", error: NOT_FOUND };
  if (row.studentId !== studentId) return { ok: false, reason: "forbidden", error: NOT_YOURS };
  if (row.status !== "open") return { ok: false, reason: "not-open", error: WITHDRAWN };
  return { ok: true };
}

// Editing (0018): the poster changes an open post under the same rules as a
// new one, while no offer on it is pending; a withdrawn offer no longer locks
// it.
export function editPost(studentId: number, postId: number, input: NewPost): EditPostResult {
  const allowed = changeable(studentId, postId);
  if (!allowed.ok) return allowed;
  if (hasPendingOffers(postId)) return { ok: false, reason: "locked", error: LOCKED };
  const checked = checkInput(input);
  if (!checked.ok) return { ok: false, reason: "invalid", error: checked.error };

  // A save that changes nothing isn't an edit: no marker, no event, and the
  // student still lands on the board with "Changes saved".
  const message = checked.message.trim() === "" ? null : checked.message;
  const current = getPost(postId);
  if (
    current &&
    current.leaving.id === input.leavingClassId &&
    current.message === message &&
    [...checked.joinClassIds].sort().join() === current.joins.map((c) => c.id).sort().join()
  ) {
    return { ok: true };
  }

  const saved = db.transaction((tx) => {
    // the status check is repeated in the update so an edit racing a withdraw
    // can't bring a withdrawn post back
    const { changes } = tx
      .update(swapPosts)
      .set({
        leavingClassId: input.leavingClassId,
        message,
        editedAt: new Date(),
      })
      .where(and(eq(swapPosts.id, postId), eq(swapPosts.status, "open")))
      .run();
    if (changes === 0) return false;
    tx.delete(swapPostJoinClasses).where(eq(swapPostJoinClasses.postId, postId)).run();
    tx.insert(swapPostJoinClasses)
      .values(checked.joinClassIds.map((classId) => ({ postId, classId })))
      .run();
    return true;
  });
  if (!saved) return { ok: false, reason: "not-open", error: WITHDRAWN };

  publishPostChanged(postId, "edited");
  return { ok: true };
}

// Withdrawing (0018): the poster takes an open post down at any time. It
// leaves the board and they can post again; its page still loads (0020). Its
// pending offers are closed with it (0025).
export function withdrawPost(studentId: number, postId: number): WithdrawPostResult {
  const allowed = changeable(studentId, postId);
  if (!allowed.ok) return allowed;

  const withdrawn = db.transaction((tx) => {
    const { changes } = tx
      .update(swapPosts)
      .set({ status: "withdrawn", withdrawnAt: new Date(), withdrawnBy: studentId })
      .where(and(eq(swapPosts.id, postId), eq(swapPosts.status, "open")))
      .run();
    if (changes === 0) return false;
    closePendingOffers(tx, postId, "post-withdrawn");
    return true;
  });
  if (!withdrawn) return { ok: false, reason: "not-open", error: WITHDRAWN };

  publishPostChanged(postId, "withdrawn");
  return { ok: true };
}

type PostRow = Omit<PostView, "leaving" | "joins" | "pendingOffers"> & { leavingClassId: string };

function toViews(rows: PostRow[]): PostView[] {
  if (rows.length === 0) return [];
  const classById = new Map(allClasses().map((c) => [c.id, c]));
  const pending = pendingOfferCounts(rows.map((r) => r.id));
  const joinRows = db
    .select()
    .from(swapPostJoinClasses)
    .where(inArray(swapPostJoinClasses.postId, rows.map((r) => r.id)))
    .all();
  return rows.map((row) => {
    const joins = joinRows
      .filter((j) => j.postId === row.id)
      .map((j) => classById.get(j.classId))
      .filter((c): c is SchoolClass => c !== undefined)
      .sort((a, b) => a.position - b.position);
    const leaving = classById.get(row.leavingClassId);
    if (!leaving) throw new Error(`post ${row.id} names an unknown class`);
    return { ...row, leaving, joins, pendingOffers: pending.get(row.id) ?? 0 };
  });
}

const postColumns = {
  id: swapPosts.id,
  studentId: swapPosts.studentId,
  username: students.username,
  leavingClassId: swapPosts.leavingClassId,
  message: swapPosts.message,
  status: swapPosts.status,
  postedAt: swapPosts.postedAt,
  editedAt: swapPosts.editedAt,
  withdrawnAt: swapPosts.withdrawnAt,
};

// Every open post, newest first (0019).
export function listOpenPosts(): PostView[] {
  const rows = db
    .select(postColumns)
    .from(swapPosts)
    .innerJoin(students, eq(swapPosts.studentId, students.id))
    .where(eq(swapPosts.status, "open"))
    .orderBy(desc(swapPosts.postedAt), desc(swapPosts.id))
    .all();
  return toViews(rows);
}

export function getPost(id: number): PostView | null {
  const rows = db
    .select(postColumns)
    .from(swapPosts)
    .innerJoin(students, eq(swapPosts.studentId, students.id))
    .where(eq(swapPosts.id, id))
    .all();
  return toViews(rows)[0] ?? null;
}

// The login page's post part of each demo line (0039): which of these
// students has an open post. A set of names, no post content.
export function usernamesWithOpenPost(usernames: readonly string[]): Set<string> {
  const rows = db
    .select({ username: students.username })
    .from(swapPosts)
    .innerJoin(students, eq(swapPosts.studentId, students.id))
    .where(and(eq(swapPosts.status, "open"), inArray(students.username, [...usernames])))
    .all();
  return new Set(rows.map((r) => r.username));
}

// A message as the board shows it: the first BOARD_MESSAGE_CUT characters,
// then "…" if there was more (0047).
export function boardMessage(message: string | null): string | null {
  if (message === null) return null;
  const chars = [...message];
  return chars.length > BOARD_MESSAGE_CUT ? `${chars.slice(0, BOARD_MESSAGE_CUT).join("")}…` : message;
}
