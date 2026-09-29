import { describe, expect, it } from "vitest";
import { boardRefetchOn, parseLiveEvent, postRefetchOn } from "../src/lib/live";

// The client's event filter (issue #22; 0042, 0044): which messages on
// /api/events make an open board or post page refetch itself.
const changed = (postId: number) => parseLiveEvent(JSON.stringify({ type: "post-changed", postId, kind: "swapped" }));

describe("the live-refresh event filter", () => {
  it("refetches the board on any post changing", () => {
    expect(boardRefetchOn(changed(1))).toBe(true);
    expect(boardRefetchOn(changed(99))).toBe(true);
  });

  it("does not refetch the board on a private message being sent (0042)", () => {
    // the id-less event 0034 will add; whatever its shape, it is not a post change
    for (const data of [
      JSON.stringify({ type: "private-message" }),
      JSON.stringify({ type: "message-sent", postId: 3, kind: "x" }),
      JSON.stringify({ type: "private-message", postId: 3, kind: "sent" }),
    ]) {
      expect(boardRefetchOn(parseLiveEvent(data))).toBe(false);
    }
  });

  it("refetches a post page only for its own post", () => {
    expect(postRefetchOn(changed(5), 5)).toBe(true);
    expect(postRefetchOn(changed(6), 5)).toBe(false);
    expect(postRefetchOn(parseLiveEvent(JSON.stringify({ type: "private-message" })), 5)).toBe(false);
  });

  it("ignores anything that is not a post-changed message", () => {
    for (const data of ["", "not json", "null", "7", "[]", JSON.stringify({ type: "post-changed" })]) {
      expect(parseLiveEvent(data)).toBeNull();
    }
  });
});
