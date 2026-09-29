// Which "/api/events" messages make an open page refetch itself (0042, 0044).
// Pure, so a spec test can check the filter without a browser; the DOM side
// is src/scripts/live.ts.

export interface PostChanged {
  type: "post-changed";
  postId: number;
  kind: string;
}

/** The stream's `data:` payload as an event this filter knows, else null. */
export function parseLiveEvent(data: string): PostChanged | null {
  try {
    const message: unknown = JSON.parse(data);
    if (typeof message !== "object" || message === null) return null;
    const { type, postId, kind } = message as Record<string, unknown>;
    if (type !== "post-changed" || typeof postId !== "number" || typeof kind !== "string") return null;
    return { type, postId, kind };
  } catch {
    return null;
  }
}

/** The board shows every post, so any "post N changed" refetches it. It does
 *  not refetch on "a private message was sent" (0042): the header's Messages
 *  count stays reload-only. */
export function boardRefetchOn(event: PostChanged | null): boolean {
  return event !== null;
}

/** A post page refetches only for its own post (0044). */
export function postRefetchOn(event: PostChanged | null, postId: number): boolean {
  return event !== null && event.postId === postId;
}
