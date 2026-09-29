import { EventEmitter } from "node:events";

// One process, one bus: every open SSE connection subscribes here, and a new
// message is broadcast to all of them. This only works because the app runs
// on exactly one machine (see fly.toml) — a second machine would have its own
// bus and clients would miss events.
export const bus = new EventEmitter();
bus.setMaxListeners(0);

// "post N changed" (0043). /api/events is public, so this carries only the
// post id and a kind: never a username, class, message or any other content.
export type PostChangeKind = "created";

export function publishPostChanged(postId: number, kind: PostChangeKind): void {
  bus.emit("message", { type: "post-changed", postId, kind });
}
