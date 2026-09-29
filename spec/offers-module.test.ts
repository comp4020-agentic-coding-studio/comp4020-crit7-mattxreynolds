import { describe, expect, it } from "vitest";
import {
  checkOffer,
  closeTransition,
  countLabel,
  offerLabel,
  offersToAnswerLabel,
  withdrawTransition,
} from "../src/lib/offers";

// The offer rules as a pure module (issue #20, decisions 0022, 0025): no
// database, so the transition rules are tested directly. The accept and
// decline transitions (#21) extend this same module.
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
