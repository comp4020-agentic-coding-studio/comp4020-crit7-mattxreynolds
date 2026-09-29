import { describe, expect, it } from "vitest";
import {
  acceptTransition,
  checkAnswer,
  checkOffer,
  closeTransition,
  countLabel,
  declineTransition,
  offerLabel,
  offersToAnswerLabel,
  planAccept,
  swappedSentence,
  withdrawTransition,
} from "../src/lib/offers";

// The offer rules as a pure module (issue #20, decisions 0022, 0025): no
// database, so the transition rules are tested directly. Accept, decline and
// the cascade an accept sets off (#21, decision 0024) extend this same module.
const post = { studentId: 1, status: "open", joinClassIds: ["baishi", "dachi"] };
const offer = { offererId: 2, post, offeredClassId: "baishi", offersByOfferer: [] as { status: string }[] };

describe("checkOffer", () => {
  it("accepts another student offering from one of the post's join classes on an open post", () => {
    expect(checkOffer(offer)).toBeNull();
  });

  it("refuses an offer on your own post", () => {
    expect(checkOffer({ ...offer, offererId: 1 })?.reason).toBe("own-post");
  });

  it("refuses an offer on a post that is not open", () => {
    for (const status of ["withdrawn", "swapped"]) {
      expect(checkOffer({ ...offer, post: { ...post, status } })?.reason, status).toBe("not-open");
    }
  });

  it("refuses a class that is not one of the post's join classes, or none at all", () => {
    expect(checkOffer({ ...offer, offeredClassId: "shitao" })?.reason).toBe("class-not-joinable");
    expect(checkOffer({ ...offer, offeredClassId: "" })?.reason).toBe("class-not-joinable");
  });

  it("refuses a second pending offer on the same post", () => {
    expect(checkOffer({ ...offer, offersByOfferer: [{ status: "pending" }] })?.reason).toBe("already-pending");
  });

  it("lets a student who withdrew their offer, or had one closed, offer again", () => {
    expect(checkOffer({ ...offer, offersByOfferer: [{ status: "withdrawn" }] })).toBeNull();
    expect(checkOffer({ ...offer, offersByOfferer: [{ status: "closed" }, { status: "withdrawn" }] })).toBeNull();
  });

  it("refuses a student whose offer on the post was declined", () => {
    expect(checkOffer({ ...offer, offersByOfferer: [{ status: "withdrawn" }, { status: "declined" }] })?.reason).toBe(
      "declined-before",
    );
  });

  it("says why, in words a student can read", () => {
    expect(checkOffer({ ...offer, offererId: 1 })?.error).toBe("You can't offer on your own swap post.");
  });
});

describe("transitions", () => {
  it("lets the offerer withdraw only a pending offer", () => {
    expect(withdrawTransition({ status: "pending" })).toEqual({ status: "withdrawn", closedReason: null });
    for (const status of ["accepted", "declined", "withdrawn", "closed"]) {
      expect(withdrawTransition({ status }), status).toBeNull();
    }
  });

  it("closes only a pending offer, keeping the reason", () => {
    expect(closeTransition({ status: "pending" }, "post-withdrawn")).toEqual({
      status: "closed",
      closedReason: "post-withdrawn",
    });
    for (const status of ["accepted", "declined", "withdrawn", "closed"]) {
      expect(closeTransition({ status }, "post-withdrawn"), status).toBeNull();
    }
  });
});

describe("labels", () => {
  it("names each status as its offerer sees it (0025)", () => {
    expect(offerLabel({ status: "pending", closedReason: null })).toBe("Pending");
    expect(offerLabel({ status: "accepted", closedReason: null })).toBe("Accepted");
    expect(offerLabel({ status: "declined", closedReason: null })).toBe("Declined");
    expect(offerLabel({ status: "withdrawn", closedReason: null })).toBe("You withdrew");
    expect(offerLabel({ status: "closed", closedReason: "post-withdrawn" })).toBe("Post withdrawn");
    expect(offerLabel({ status: "closed", closedReason: "post-swapped" })).toBe("Post swapped with someone else");
    expect(offerLabel({ status: "closed", closedReason: "offerer-swapped" })).toBe("Closed: you swapped");
  });

  it("counts with the right plural", () => {
    expect(countLabel(0)).toBe("0 pending offers");
    expect(countLabel(1)).toBe("1 pending offer");
    expect(countLabel(2)).toBe("2 pending offers");
    expect(offersToAnswerLabel(1)).toBe("1 offer to answer");
    expect(offersToAnswerLabel(2)).toBe("2 offers to answer");
  });
});

describe("checkAnswer: who may accept or decline (0024)", () => {
  const answer = { actorId: 1, post: { studentId: 1, status: "open" }, offer: { status: "pending" } };

  it("lets the poster answer a pending offer on their open post", () => {
    expect(checkAnswer(answer)).toBeNull();
  });

  it("refuses anyone but the poster, before saying anything about the offer", () => {
    expect(checkAnswer({ ...answer, actorId: 2 })?.reason).toBe("forbidden");
    expect(checkAnswer({ ...answer, actorId: 2, offer: { status: "accepted" } })?.reason).toBe("forbidden");
  });

  it("refuses a post that is no longer open, so a stale accept after a swap is refused", () => {
    for (const status of ["withdrawn", "swapped"]) {
      expect(checkAnswer({ ...answer, post: { studentId: 1, status } })?.reason, status).toBe("not-open");
    }
  });

  it("refuses an offer that is not pending", () => {
    for (const status of ["accepted", "declined", "withdrawn", "closed"]) {
      expect(checkAnswer({ ...answer, offer: { status } })?.reason, status).toBe("not-pending");
    }
  });
});

describe("accept and decline transitions", () => {
  it("accepts and declines only a pending offer", () => {
    expect(acceptTransition({ status: "pending" })).toEqual({ status: "accepted", closedReason: null });
    expect(declineTransition({ status: "pending" })).toEqual({ status: "declined", closedReason: null });
    for (const status of ["accepted", "declined", "withdrawn", "closed"]) {
      expect(acceptTransition({ status }), status).toBeNull();
      expect(declineTransition({ status }), status).toBeNull();
    }
  });

  it("never lets the offerer withdraw an accepted offer", () => {
    expect(withdrawTransition({ status: "accepted" })).toBeNull();
  });
});

// Students 1 (poster) and 2 (offerer). Post 10 is the poster's, accepted from
// offerer 2; post 20 is the offerer's own open post. Offers 3+ are pending.
describe("planAccept: what an accept closes (0024)", () => {
  const base = {
    accepted: { id: 1, postId: 10, offererId: 2 },
    posterId: 1,
    offererOpenPostId: 20 as number | null,
  };
  const closes = (pending: { id: number; postId: number; offererId: number }[], offererOpenPostId = base.offererOpenPostId) =>
    planAccept({ ...base, offererOpenPostId, pending }).close.map((c) => [c.offerId, c.reason]);

  it("closes the post's other pending offers as 'post-swapped'", () => {
    expect(closes([{ id: 3, postId: 10, offererId: 5 }, { id: 4, postId: 10, offererId: 6 }])).toEqual([
      [3, "post-swapped"],
      [4, "post-swapped"],
    ]);
  });

  it("closes every other pending offer by the offerer, on any post, as 'offerer-swapped'", () => {
    expect(closes([{ id: 3, postId: 30, offererId: 2 }, { id: 4, postId: 31, offererId: 2 }])).toEqual([
      [3, "offerer-swapped"],
      [4, "offerer-swapped"],
    ]);
  });

  it("closes every pending offer by the poster, on any post, as 'offerer-swapped'", () => {
    expect(closes([{ id: 3, postId: 30, offererId: 1 }])).toEqual([[3, "offerer-swapped"]]);
  });

  it("withdraws the offerer's open post and closes its pending offers as 'post-withdrawn'", () => {
    const plan = planAccept({ ...base, pending: [{ id: 3, postId: 20, offererId: 5 }] });
    expect(plan.withdrawPostId).toBe(20);
    expect(plan.close).toEqual([{ offerId: 3, reason: "post-withdrawn" }]);
  });

  it("withdraws no post when the offerer has no open post", () => {
    const plan = planAccept({ ...base, offererOpenPostId: null, pending: [] });
    expect(plan.withdrawPostId).toBeNull();
    expect(plan.close).toEqual([]);
  });

  it("closes a student's own offer as 'offerer-swapped' even when it is on the post the swap withdrew", () => {
    // the poster had offered on the offerer's post: they swapped, so that is what they are told
    expect(closes([{ id: 3, postId: 20, offererId: 1 }])).toEqual([[3, "offerer-swapped"]]);
  });

  it("closes nothing else: offers between other students on other posts stay pending", () => {
    const plan = planAccept({
      ...base,
      pending: [
        { id: 3, postId: 30, offererId: 5 },
        { id: 4, postId: 31, offererId: 6 },
        { id: 5, postId: 10, offererId: 7 },
      ],
    });
    expect(plan.close).toEqual([{ offerId: 5, reason: "post-swapped" }]);
  });

  it("never closes the accepted offer itself, and names each offer once", () => {
    const pending = [
      { id: 1, postId: 10, offererId: 2 },
      { id: 3, postId: 30, offererId: 2 },
      { id: 3, postId: 30, offererId: 2 },
    ];
    expect(planAccept({ ...base, pending }).close.map((c) => c.offerId)).toEqual([3]);
  });
});

describe("swappedSentence (0024)", () => {
  it("says who moves where, and that the change is made in MyTimetable", () => {
    expect(
      swappedSentence({ poster: "alex", offered: "Wed 09:00–10:30", offerer: "priya", leaving: "Mon 14:00–15:30" }),
    ).toBe(
      "Swapped: alex moves to Wed 09:00–10:30, priya moves to Mon 14:00–15:30. Make the change in MyTimetable. This app can't.",
    );
  });
});
