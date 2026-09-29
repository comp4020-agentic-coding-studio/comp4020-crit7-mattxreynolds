import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "./db";
import { publishPostChanged } from "./events";
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
}

export interface NewPost {
  leavingClassId: string;
  joinClassIds: string[];
  message: string;
}

export type CreatePostResult =
  | { ok: true; postId: number }
  | { ok: false; error: string; existingPostId?: number };

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

// Every rule here is enforced on the server (0017, 0016): the form only makes
// the mistakes hard to make.
export function createPost(studentId: number, input: NewPost): CreatePostResult {
  const existingPostId = openPostIdFor(studentId);
  if (existingPostId !== null) {
    return { ok: false, error: "You already have an open post.", existingPostId };
  }

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

function toViews(rows: { id: number; studentId: number; username: string; leavingClassId: string; message: string | null; status: string; postedAt: Date }[]): PostView[] {
  if (rows.length === 0) return [];
  const classById = new Map(allClasses().map((c) => [c.id, c]));
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
    return { ...row, leaving, joins };
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
