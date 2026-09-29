import { and, asc, desc, eq, inArray, or, sql } from "drizzle-orm";
import { db } from "./db";
import { publishPostChanged } from "./events";
import {
  type AnswerRefusal,
  type ClosedReason,
  type OfferRefusal,
  acceptTransition,
  checkAnswer,
  checkOffer,
  closeTransition,
  declineTransition,
  planAccept,
  withdrawTransition,
} from "./offers";
import { type SchoolClass, classes, offers, students, swapPostJoinClasses, swapPosts } from "./schema";

// The database side of offers (0022, 0023, 0025). The rules are in offers.ts;
// this reads what they need, applies what they decide, and tells the board.
export type MakeOfferResult =
  | { ok: true; offerId: number }
  | { ok: false; reason: "not-found" | OfferRefusal["reason"]; error: string };

export type WithdrawOfferResult =
  | { ok: true }
  | { ok: false; reason: "not-found" | "forbidden" | "not-pending"; error: string };

export type AnswerOfferResult =
  | { ok: true; postId: number }
  | { ok: false; reason: "not-found" | AnswerRefusal["reason"]; error: string };

const NO_SUCH_OFFER = "There is no offer with that number.";
const NOT_PENDING = "This offer is not pending, so it can't be answered.";

const classById = (): Map<string, SchoolClass> =>
  new Map(db.select().from(classes).all().map((c) => [c.id, c]));

export function makeOffer(offererId: number, postId: number, offeredClassId: string): MakeOfferResult {
  let created: MakeOfferResult;
  try {
    created = db.transaction((tx): MakeOfferResult => {
      const post = tx
        .select({ studentId: swapPosts.studentId, status: swapPosts.status })
        .from(swapPosts)
        .where(eq(swapPosts.id, postId))
        .get();
      if (!post) return { ok: false, reason: "not-found", error: "There is no swap post with that number." };
      const joinClassIds = tx
        .select({ classId: swapPostJoinClasses.classId })
        .from(swapPostJoinClasses)
        .where(eq(swapPostJoinClasses.postId, postId))
        .all()
        .map((row) => row.classId);
      const offersByOfferer = tx
        .select({ status: offers.status })
        .from(offers)
        .where(and(eq(offers.postId, postId), eq(offers.offererId, offererId)))
        .all();

      const refusal = checkOffer({ offererId, post: { ...post, joinClassIds }, offeredClassId, offersByOfferer });
      if (refusal) return { ok: false, ...refusal };

      const row = tx
        .insert(offers)
        .values({ postId, offererId, offeredClassId, createdAt: new Date() })
        .returning({ id: offers.id })
        .get();
      return { ok: true, offerId: row.id };
    });
  } catch (error) {
    // two requests from one student can both pass the check above; the
    // partial unique index is the real guard
    if (error instanceof Error && /UNIQUE constraint failed/.test(error.message)) {
      return { ok: false, reason: "already-pending", error: "You already have a pending offer on this swap post." };
    }
    throw error;
  }

  if (created.ok) publishPostChanged(postId, "offer-made");
  return created;
}

// The offerer takes back a pending offer (0022). Only their own, and only
// while it is pending: an answered offer stays as it was answered.
export function withdrawOffer(studentId: number, offerId: number): WithdrawOfferResult {
  const offer = db
    .select({ postId: offers.postId, offererId: offers.offererId, status: offers.status })
    .from(offers)
    .where(eq(offers.id, offerId))
    .get();
  if (!offer) return { ok: false, reason: "not-found", error: "There is no offer with that number." };
  if (offer.offererId !== studentId) {
    return { ok: false, reason: "forbidden", error: "Only the student who made an offer can withdraw it." };
  }
  const change = withdrawTransition(offer);
  if (!change) return { ok: false, reason: "not-pending", error: "This offer is not pending, so it can't be withdrawn." };

  const { changes } = db
    .update(offers)
    .set({ status: change.status, closedReason: change.closedReason, resolvedAt: new Date() })
    .where(and(eq(offers.id, offerId), eq(offers.status, "pending")))
    .run();
  if (changes === 0) return { ok: false, reason: "not-pending", error: "This offer is not pending, so it can't be withdrawn." };

  publishPostChanged(offer.postId, "offer-withdrawn");
  return { ok: true };
}

// The poster turns down a pending offer (0024): one click, no reason. The post
// stays open, and the offerer can't offer on it again (0022).
export function declineOffer(studentId: number, offerId: number): AnswerOfferResult {
  const offer = db
    .select({ postId: offers.postId, status: offers.status })
    .from(offers)
    .where(eq(offers.id, offerId))
    .get();
  if (!offer) return { ok: false, reason: "not-found", error: NO_SUCH_OFFER };
  const post = db
    .select({ studentId: swapPosts.studentId, status: swapPosts.status })
    .from(swapPosts)
    .where(eq(swapPosts.id, offer.postId))
    .get();
  if (!post) return { ok: false, reason: "not-found", error: NO_SUCH_OFFER };
  const refusal = checkAnswer({ actorId: studentId, post, offer });
  if (refusal) return { ok: false, ...refusal };
  const change = declineTransition(offer);
  if (!change) return { ok: false, reason: "not-pending", error: NOT_PENDING };

  const { changes } = db
    .update(offers)
    .set({ status: change.status, closedReason: change.closedReason, resolvedAt: new Date() })
    .where(and(eq(offers.id, offerId), eq(offers.status, "pending")))
    .run();
  if (changes === 0) return { ok: false, reason: "not-pending", error: NOT_PENDING };

  publishPostChanged(offer.postId, "offer-declined");
  return { ok: true, postId: offer.postId };
}

// The poster accepts a pending offer (0024), which is final. One transaction
// makes the offer accepted and the post swapped, and closes what planAccept
// says: the post's other offers, every other pending offer by either student,
// and the offerer's own open post with its offers. Nothing is half done: if
// any step fails, none of it happened. Each post that changed then gets its one
// event.
export function acceptOffer(studentId: number, offerId: number): AnswerOfferResult {
  const outcome = db.transaction(
    (tx): AnswerOfferResult & { events?: Map<number, "swapped" | "withdrawn" | "offer-closed"> } => {
      const offer = tx
        .select({ id: offers.id, postId: offers.postId, offererId: offers.offererId, status: offers.status })
        .from(offers)
        .where(eq(offers.id, offerId))
        .get();
      if (!offer) return { ok: false, reason: "not-found", error: NO_SUCH_OFFER };
      const post = tx
        .select({ studentId: swapPosts.studentId, status: swapPosts.status })
        .from(swapPosts)
        .where(eq(swapPosts.id, offer.postId))
        .get();
      if (!post) return { ok: false, reason: "not-found", error: NO_SUCH_OFFER };
      const refusal = checkAnswer({ actorId: studentId, post, offer });
      if (refusal) return { ok: false, ...refusal };

      const offererOpenPostId =
        tx
          .select({ id: swapPosts.id })
          .from(swapPosts)
          .where(and(eq(swapPosts.studentId, offer.offererId), eq(swapPosts.status, "open")))
          .get()?.id ?? null;
      const involvedPosts = offererOpenPostId === null ? [offer.postId] : [offer.postId, offererOpenPostId];
      const pending = tx
        .select({ id: offers.id, postId: offers.postId, offererId: offers.offererId })
        .from(offers)
        .where(
          and(
            eq(offers.status, "pending"),
            or(inArray(offers.offererId, [post.studentId, offer.offererId]), inArray(offers.postId, involvedPosts)),
          ),
        )
        .all();
      const plan = planAccept({ accepted: offer, posterId: post.studentId, offererOpenPostId, pending });

      const now = new Date();
      const accepted = acceptTransition(offer);
      if (!accepted) return { ok: false, reason: "not-pending", error: NOT_PENDING };
      tx.update(offers)
        .set({ status: accepted.status, closedReason: accepted.closedReason, resolvedAt: now })
        .where(eq(offers.id, offerId))
        .run();
      tx.update(swapPosts).set({ status: "swapped" }).where(eq(swapPosts.id, offer.postId)).run();
      const events = new Map<number, "swapped" | "withdrawn" | "offer-closed">([[offer.postId, "swapped"]]);

      // withdrawn by the swap: nobody withdrew it, so withdrawn_by stays empty
      if (plan.withdrawPostId !== null) {
        tx.update(swapPosts)
          .set({ status: "withdrawn", withdrawnAt: now, withdrawnBy: null })
          .where(eq(swapPosts.id, plan.withdrawPostId))
          .run();
        events.set(plan.withdrawPostId, "withdrawn");
      }
      const postOf = new Map(pending.map((o) => [o.id, o.postId]));
      for (const { offerId: closingId, reason } of plan.close) {
        const change = closeTransition({ status: "pending" }, reason);
        if (!change) continue;
        tx.update(offers)
          .set({ status: change.status, closedReason: change.closedReason, resolvedAt: now })
          .where(eq(offers.id, closingId))
          .run();
        const closedPost = postOf.get(closingId);
        if (closedPost !== undefined && !events.has(closedPost)) events.set(closedPost, "offer-closed");
      }
      return { ok: true, postId: offer.postId, events };
    },
  );

  if (!outcome.ok) return outcome;
  for (const [postId, kind] of outcome.events ?? []) publishPostChanged(postId, kind);
  return { ok: true, postId: outcome.postId };
}

// The app ends every pending offer on a post (0025), for `reason`. It runs
// inside the caller's transaction so the post and its offers change together,
// and the caller's own event covers the post (one event per affected post).
export function closePendingOffers(tx: Pick<typeof db, "select" | "update">, postId: number, reason: ClosedReason): void {
  const pending = tx
    .select({ id: offers.id, status: offers.status })
    .from(offers)
    .where(and(eq(offers.postId, postId), eq(offers.status, "pending")))
    .all();
  for (const offer of pending) {
    const change = closeTransition(offer, reason);
    if (!change) continue;
    tx.update(offers)
      .set({ status: change.status, closedReason: change.closedReason, resolvedAt: new Date() })
      .where(eq(offers.id, offer.id))
      .run();
  }
}

// How many pending offers each post has (0023): the one number everyone sees.
export function pendingOfferCounts(postIds: number[]): Map<number, number> {
  if (postIds.length === 0) return new Map();
  const rows = db
    .select({ postId: offers.postId, n: sql<number>`count(*)` })
    .from(offers)
    .where(and(inArray(offers.postId, postIds), eq(offers.status, "pending")))
    .groupBy(offers.postId)
    .all();
  return new Map(rows.map((r) => [r.postId, r.n]));
}

export function hasPendingOffers(postId: number): boolean {
  return (pendingOfferCounts([postId]).get(postId) ?? 0) > 0;
}

export interface PostOffer {
  id: number;
  offerer: string;
  offered: SchoolClass;
}

// The pending offers on a post, oldest first: what the poster sees (0023).
// Callers show it to the poster only.
export function pendingOffersOn(postId: number): PostOffer[] {
  const byId = classById();
  return db
    .select({ id: offers.id, offerer: students.username, offeredClassId: offers.offeredClassId })
    .from(offers)
    .innerJoin(students, eq(offers.offererId, students.id))
    .where(and(eq(offers.postId, postId), eq(offers.status, "pending")))
    .orderBy(asc(offers.createdAt), asc(offers.id))
    .all()
    .flatMap((row) => {
      const offered = byId.get(row.offeredClassId);
      return offered ? [{ id: row.id, offerer: row.offerer, offered }] : [];
    });
}

export interface AcceptedSwap {
  offerer: string;
  offered: SchoolClass;
}

// Who a swapped post was swapped with and the class they leave (0024): the
// post's accepted offer.
export function acceptedSwapOn(postId: number): AcceptedSwap | null {
  const row = db
    .select({ offerer: students.username, offeredClassId: offers.offeredClassId })
    .from(offers)
    .innerJoin(students, eq(offers.offererId, students.id))
    .where(and(eq(offers.postId, postId), eq(offers.status, "accepted")))
    .get();
  const offered = row ? classById().get(row.offeredClassId) : undefined;
  return row && offered ? { offerer: row.offerer, offered } : null;
}

export interface OfferToAnswer {
  id: number;
  postId: number;
  posterId: number;
  postStatus: string;
  status: string;
  offerer: string;
  offered: SchoolClass;
  leaving: SchoolClass;
}

// An offer with what the confirm step says about it (0024). Callers show it
// to the poster only.
export function offerToAnswer(offerId: number): OfferToAnswer | null {
  const byId = classById();
  const row = db
    .select({
      id: offers.id,
      postId: offers.postId,
      posterId: swapPosts.studentId,
      postStatus: swapPosts.status,
      status: offers.status,
      offerer: students.username,
      offeredClassId: offers.offeredClassId,
      leavingClassId: swapPosts.leavingClassId,
    })
    .from(offers)
    .innerJoin(swapPosts, eq(offers.postId, swapPosts.id))
    .innerJoin(students, eq(offers.offererId, students.id))
    .where(eq(offers.id, offerId))
    .get();
  if (!row) return null;
  const { offeredClassId, leavingClassId, ...rest } = row;
  const offered = byId.get(offeredClassId);
  const leaving = byId.get(leavingClassId);
  return offered && leaving ? { ...rest, offered, leaving } : null;
}

export interface OwnOffer {
  id: number;
  postId: number;
  poster: string;
  postStatus: string;
  offered: SchoolClass;
  status: string;
  closedReason: string | null;
  createdAt: Date;
}

// Every offer a student has made, pending first and then newest first (0025).
export function offersMadeBy(studentId: number): OwnOffer[] {
  const byId = classById();
  return db
    .select({
      id: offers.id,
      postId: offers.postId,
      poster: students.username,
      postStatus: swapPosts.status,
      offeredClassId: offers.offeredClassId,
      status: offers.status,
      closedReason: offers.closedReason,
      createdAt: offers.createdAt,
    })
    .from(offers)
    .innerJoin(swapPosts, eq(offers.postId, swapPosts.id))
    .innerJoin(students, eq(swapPosts.studentId, students.id))
    .where(eq(offers.offererId, studentId))
    .orderBy(sql`${offers.status} = 'pending' desc`, desc(offers.createdAt), desc(offers.id))
    .all()
    .flatMap(({ offeredClassId, ...row }) => {
      const offered = byId.get(offeredClassId);
      return offered ? [{ ...row, offered }] : [];
    });
}

// A student's own offer on one post, for the offerer's view of the post page
// (0023): the pending one if there is one, else the latest.
export function ownOfferOn(studentId: number, postId: number): OwnOffer | null {
  const [offer] = offersMadeBy(studentId).filter((o) => o.postId === postId);
  return offer ?? null;
}

// Whether the poster has declined this student's offer on the post, so the
// page shows no "Offer to swap" (0022). The server enforces it either way.
export function declinedOfferOn(studentId: number, postId: number): boolean {
  return db
    .select({ id: offers.id })
    .from(offers)
    .where(and(eq(offers.postId, postId), eq(offers.offererId, studentId), eq(offers.status, "declined")))
    .get() !== undefined;
}

export interface DemoOfferCounts {
  toAnswer: number;
  made: number;
}

// The offer parts of each demo student's login line (0039): pending offers on
// their open post, and pending offers they have made. Counts only.
export function demoOfferCounts(usernames: readonly string[]): Map<string, DemoOfferCounts> {
  // matched ignoring case (0059): a volume seeded before it holds lowercase names
  const lower = usernames.map((u) => u.toLowerCase());
  const nameOf = new Map(usernames.map((u) => [u.toLowerCase(), u]));
  const result = new Map<string, DemoOfferCounts>(usernames.map((u) => [u, { toAnswer: 0, made: 0 }]));
  const made = db
    .select({ username: sql<string>`lower(${students.username})`, n: sql<number>`count(*)` })
    .from(offers)
    .innerJoin(students, eq(offers.offererId, students.id))
    .where(and(eq(offers.status, "pending"), inArray(sql`lower(${students.username})`, lower)))
    .groupBy(sql`lower(${students.username})`)
    .all();
  for (const row of made) {
    const counts = result.get(nameOf.get(row.username) ?? "");
    if (counts) counts.made = row.n;
  }
  const toAnswer = db
    .select({ username: sql<string>`lower(${students.username})`, n: sql<number>`count(*)` })
    .from(offers)
    .innerJoin(swapPosts, eq(offers.postId, swapPosts.id))
    .innerJoin(students, eq(swapPosts.studentId, students.id))
    .where(and(eq(offers.status, "pending"), eq(swapPosts.status, "open"), inArray(sql`lower(${students.username})`, lower)))
    .groupBy(sql`lower(${students.username})`)
    .all();
  for (const row of toAnswer) {
    const counts = result.get(nameOf.get(row.username) ?? "");
    if (counts) counts.toAnswer = row.n;
  }
  return result;
}
