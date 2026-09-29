import { describe, expect, it } from "vitest";
import { CLASSES } from "../src/lib/classes";
import { baseUrl, newStudent, ownPostId, submitEdit, submitPost, usernameOf, withdrawPost } from "./helpers";

// "post N changed" on the public stream (issue #18, decision 0043): the post
// id and a kind, and nothing a logged-out reader must not see. Other spec
// files post on the same server at the same time, so the stream is read until
// this test's own post shows up.
async function readUntil(
  stream: ReadableStreamDefaultReader<Uint8Array>,
  done: (seen: string) => boolean,
  ms = 5000,
): Promise<string> {
  const decoder = new TextDecoder();
  let seen = "";
  const deadline = Date.now() + ms;
  while (!done(seen)) {
    const left = deadline - Date.now();
    if (left <= 0) throw new Error(`stream did not deliver what was expected within ${ms}ms; saw: ${seen}`);
    const chunk = await Promise.race([
      stream.read(),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), left)),
    ]);
    if (chunk === null || chunk.done) continue;
    seen += decoder.decode(chunk.value);
  }
  return seen;
}

describe("/api/events", () => {
  it("broadcasts post N changed when a post is created, with no username, class or message text", async () => {
    const cookie = await newStudent("eventer");
    const username = await usernameOf(cookie);
    const message = "distinctive-message-text-12345";

    const controller = new AbortController();
    const res = await fetch(new URL("/api/events", baseUrl), { signal: controller.signal });
    expect(res.status).toBe(200);
    const stream = (res.body as ReadableStream<Uint8Array>).getReader();
    try {
      await readUntil(stream, (seen) => seen.includes(": connected"));
      const posted = await submitPost(cookie, { leaving: CLASSES[0].id, join: [CLASSES[2].id], message });
      expect(posted.status).toBe(303);
      const id = await ownPostId(cookie);
      expect(id).not.toBeNull();

      const raw = await readUntil(stream, (seen) => seen.includes(`"postId":${id},`));
      const line = raw.split("\n").find((l) => l.startsWith("data: ") && l.includes(`"postId":${id},`));
      expect(JSON.parse(line?.slice(6) ?? "null")).toEqual({ type: "post-changed", postId: id, kind: "created" });

      const lower = raw.toLowerCase();
      expect(lower).not.toContain(username.toLowerCase());
      expect(lower).not.toContain(message);
      for (const c of CLASSES) {
        for (const word of [c.id, c.start, c.end, c.tutor]) expect(lower).not.toContain(word.toLowerCase());
      }
    } finally {
      controller.abort();
    }
  });

  it("broadcasts post N changed when a post is edited and when it is withdrawn, with no content", async () => {
    const cookie = await newStudent("eventer");
    const username = await usernameOf(cookie);
    const before = "distinctive-before-text-12345";
    const after = "distinctive-after-text-67890";
    expect((await submitPost(cookie, { leaving: CLASSES[0].id, join: [CLASSES[2].id], message: before })).status).toBe(303);
    const id = await ownPostId(cookie);
    expect(id).not.toBeNull();

    const controller = new AbortController();
    const res = await fetch(new URL("/api/events", baseUrl), { signal: controller.signal });
    const stream = (res.body as ReadableStream<Uint8Array>).getReader();
    try {
      await readUntil(stream, (seen) => seen.includes(": connected"));
      // a save that changes nothing sends no event (only the two below do)
      expect((await submitEdit(cookie, id as number, { leaving: CLASSES[0].id, join: [CLASSES[2].id], message: before })).status).toBe(303);
      expect((await submitEdit(cookie, id as number, { leaving: CLASSES[1].id, join: [CLASSES[3].id], message: after })).status).toBe(303);
      expect((await withdrawPost(cookie, id as number, "/")).status).toBe(303);

      const raw = await readUntil(stream, (seen) => seen.includes('"kind":"withdrawn"') && seen.includes(`"postId":${id},`));
      const events = raw
        .split("\n")
        .filter((l) => l.startsWith("data: ") && l.includes(`"postId":${id},`))
        .map((l) => JSON.parse(l.slice(6)));
      expect(events).toEqual([
        { type: "post-changed", postId: id, kind: "edited" },
        { type: "post-changed", postId: id, kind: "withdrawn" },
      ]);

      const lower = raw.toLowerCase();
      for (const secret of [username, before, after]) expect(lower).not.toContain(secret.toLowerCase());
      for (const c of CLASSES) {
        for (const word of [c.id, c.start, c.end, c.tutor]) expect(lower).not.toContain(word.toLowerCase());
      }
    } finally {
      controller.abort();
    }
  });
});
