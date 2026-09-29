// The offer rules, with no database in reach (0022, 0025): what may be
// offered, how an offer's status changes, and the words for each status. The
// database side lives in offer-store.ts and only applies what is decided
// here. Accepting and declining (0024) extend this module.
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
