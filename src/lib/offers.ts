// The offer rules, with no database in reach (0022, 0025): what may be
// offered, how an offer's status changes, and the words for each status. The
// database side lives in offer-store.ts and only applies what is decided
// here. Accepting, declining and the cascade an accept sets off (0024) are here
// too.
export type OfferStatus = "pending" | "accepted" | "declined" | "withdrawn" | "closed";
// why the app ended an offer (0025); stored, so the label is read back and
// never worked out afterwards
export type ClosedReason = "post-withdrawn" | "post-swapped" | "offerer-swapped";

export interface OfferRefusal {
  reason: "own-post" | "not-open" | "class-not-joinable" | "already-pending" | "declined-before";
  error: string;
}

export interface OfferAttempt {
  offererId: number;
  post: { studentId: number; status: string; joinClassIds: readonly string[] };
  offeredClassId: string;
  // the offers this student has already made on this post, whatever their status
  offersByOfferer: readonly { status: string }[];
}

// The server-side rules for making an offer (0022), in the order a refusal is
// worth reading: whose post it is, whether it is open, then the offer itself.
export function checkOffer(attempt: OfferAttempt): OfferRefusal | null {
  const { offererId, post, offeredClassId, offersByOfferer } = attempt;
  if (post.studentId === offererId) {
    return { reason: "own-post", error: "You can't offer on your own swap post." };
  }
  if (post.status !== "open") {
    return { reason: "not-open", error: "This swap post is no longer open." };
  }
  if (!post.joinClassIds.includes(offeredClassId)) {
    return { reason: "class-not-joinable", error: "Pick one of the classes this swap post would join." };
  }
  if (offersByOfferer.some((o) => o.status === "pending")) {
    return { reason: "already-pending", error: "You already have a pending offer on this swap post." };
  }
  if (offersByOfferer.some((o) => o.status === "declined")) {
    return {
      reason: "declined-before",
      error: "Your offer on this swap post was declined, so you can't offer on it again.",
    };
  }
  return null;
}

export interface OfferChange {
  status: OfferStatus;
  closedReason: ClosedReason | null;
}

// The offerer takes back a pending offer (0022); an answered offer stays as
// it was answered.
export function withdrawTransition(offer: { status: string }): OfferChange | null {
  return offer.status === "pending" ? { status: "withdrawn", closedReason: null } : null;
}

// The app ends a pending offer with a reason (0025); nothing answered is
// reopened or rewritten.
export function closeTransition(offer: { status: string }, reason: ClosedReason): OfferChange | null {
  return offer.status === "pending" ? { status: "closed", closedReason: reason } : null;
}

export interface AnswerRefusal {
  reason: "forbidden" | "not-open" | "not-pending";
  error: string;
}

// Who may accept or decline (0024): only the poster, only a pending offer, only
// on a post that is still open. Whoever isn't the poster is refused first, so a
// stranger learns nothing about the offer or the post from the reason.
export function checkAnswer(attempt: {
  actorId: number;
  post: { studentId: number; status: string };
  offer: { status: string };
}): AnswerRefusal | null {
  const { actorId, post, offer } = attempt;
  if (post.studentId !== actorId) {
    return { reason: "forbidden", error: "Only the poster can accept or decline an offer." };
  }
  if (post.status !== "open") {
    return { reason: "not-open", error: "This swap post is no longer open, so its offers can't be answered." };
  }
  if (offer.status !== "pending") {
    return { reason: "not-pending", error: "This offer is not pending, so it can't be answered." };
  }
  return null;
}

// The poster's answers (0024): each only for a pending offer.
export function acceptTransition(offer: { status: string }): OfferChange | null {
  return offer.status === "pending" ? { status: "accepted", closedReason: null } : null;
}

export function declineTransition(offer: { status: string }): OfferChange | null {
  return offer.status === "pending" ? { status: "declined", closedReason: null } : null;
}

export interface PlannedOffer {
  id: number;
  postId: number;
  offererId: number;
}

export interface AcceptPlan {
  // every offer the accept ends, once each, with why (0025)
  close: { offerId: number; reason: ClosedReason }[];
  // the offerer's own open post, withdrawn by the swap
  withdrawPostId: number | null;
}

// What accepting `accepted` closes besides itself (0024), given the pending
// offers the caller found (it may pass more than are affected; the rest are
// ignored here):
//  - a student who swapped (the poster or the offerer) has every other pending
//    offer they made, on any post, closed as "offerer-swapped";
//  - the offerer's own open post is withdrawn, and other students' pending
//    offers on it close as "post-withdrawn";
//  - the swapped post's other pending offers close as "post-swapped".
// Someone's own offer is worded by what they did, so that rule comes first.
export function planAccept(input: {
  accepted: PlannedOffer;
  posterId: number;
  offererOpenPostId: number | null;
  pending: readonly PlannedOffer[];
}): AcceptPlan {
  const { accepted, posterId, offererOpenPostId, pending } = input;
  const swapped = new Set([posterId, accepted.offererId]);
  const close = new Map<number, ClosedReason>();
  for (const offer of pending) {
    if (offer.id === accepted.id) continue;
    if (swapped.has(offer.offererId)) close.set(offer.id, "offerer-swapped");
    else if (offer.postId === accepted.postId) close.set(offer.id, "post-swapped");
    else if (offer.postId === offererOpenPostId) close.set(offer.id, "post-withdrawn");
  }
  return {
    close: [...close].map(([offerId, reason]) => ({ offerId, reason })),
    withdrawPostId: offererOpenPostId,
  };
}

// What a swapped post's page says (0024).
export function swappedSentence(swap: { poster: string; offered: string; offerer: string; leaving: string }): string {
  return `Swapped: ${swap.poster} moves to ${swap.offered}, ${swap.offerer} moves to ${swap.leaving}. Make the change in MyTimetable. This app can't.`;
}

const CLOSED_LABELS: Record<ClosedReason, string> = {
  "post-withdrawn": "Post withdrawn",
  "post-swapped": "Post swapped with someone else",
  "offerer-swapped": "Closed: you swapped",
};

// A status as its offerer sees it (0025).
export function offerLabel(offer: { status: string; closedReason: string | null }): string {
  switch (offer.status) {
    case "pending":
      return "Pending";
    case "accepted":
      return "Accepted";
    case "declined":
      return "Declined";
    case "withdrawn":
      return "You withdrew";
    default:
      return CLOSED_LABELS[offer.closedReason as ClosedReason] ?? "Closed";
  }
}

// "N pending offers" (0019, 0023) and the demo line's "N offers to answer"
// (0039): the same number, worded for who is reading.
export function countLabel(n: number): string {
  return `${n} pending ${n === 1 ? "offer" : "offers"}`;
}

export function offersToAnswerLabel(n: number): string {
  return `${n} ${n === 1 ? "offer" : "offers"} to answer`;
}
