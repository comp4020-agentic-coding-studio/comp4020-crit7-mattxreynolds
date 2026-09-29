import { describe, expect, it } from "vitest";
import { CLASSES } from "../src/lib/classes";
import {
  acceptOffer,
  baseUrl,
  declineOffer,
  newStudent,
  offerIdsOn,
  ownOfferId,
  ownPostId,
  submitEdit,
  submitOffer,
  submitPost,
  usernameOf,
  withdrawOffer,
  withdrawPost,
} from "./helpers";

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

  it("broadcasts post N changed once per affected post as offers are made, withdrawn and closed, with no content", async () => {
    const poster = await newStudent("eventer");
    const offererA = await newStudent("offevta");
    const offererB = await newStudent("offevtb");
    const names = [await usernameOf(poster), await usernameOf(offererA), await usernameOf(offererB)];
    const message = "distinctive-offer-post-text-13579";
    expect((await submitPost(poster, { leaving: CLASSES[0].id, join: [CLASSES[2].id, CLASSES[3].id], message })).status).toBe(303);
    const id = await ownPostId(poster);
    expect(id).not.toBeNull();

    const controller = new AbortController();
    const res = await fetch(new URL("/api/events", baseUrl), { signal: controller.signal });
    const stream = (res.body as ReadableStream<Uint8Array>).getReader();
    try {
      await readUntil(stream, (seen) => seen.includes(": connected"));
      // refused offers change nothing and send nothing
      expect((await submitOffer(poster, id as number, { class: CLASSES[2].id })).status).toBe(403);
      expect((await submitOffer(offererA, id as number, { class: CLASSES[0].id })).status).toBe(400);

      expect((await submitOffer(offererA, id as number, { class: CLASSES[2].id })).status).toBe(303);
      const aOffer = await ownOfferId(offererA, id as number);
      expect((await withdrawOffer(offererA, aOffer as number, "/")).status).toBe(303);
      expect((await submitOffer(offererB, id as number, { class: CLASSES[3].id })).status).toBe(303);
      // withdrawing the post closes B's pending offer: still one event for the post
      expect((await withdrawPost(poster, id as number, "/")).status).toBe(303);

      const raw = await readUntil(stream, (seen) => seen.includes('"kind":"withdrawn"') && seen.includes(`"postId":${id},`));
      const events = raw
        .split("\n")
        .filter((l) => l.startsWith("data: ") && l.includes(`"postId":${id},`))
        .map((l) => JSON.parse(l.slice(6)));
      expect(events).toEqual([
        { type: "post-changed", postId: id, kind: "offer-made" },
        { type: "post-changed", postId: id, kind: "offer-withdrawn" },
        { type: "post-changed", postId: id, kind: "offer-made" },
        { type: "post-changed", postId: id, kind: "withdrawn" },
      ]);

      const lower = raw.toLowerCase();
      for (const secret of [...names, message]) expect(lower).not.toContain(secret.toLowerCase());
      for (const c of CLASSES) {
        for (const word of [c.id, c.start, c.end, c.tutor]) expect(lower).not.toContain(word.toLowerCase());
      }
    } finally {
      controller.abort();
    }
  });

  it("broadcasts post N changed for a decline, and for every post an accept changes, with no content", async () => {
    const [MON_14, , WED_9, WED_1030, WED_14, WED_1530] = CLASSES.map((c) => c.id);
    const poster = await newStudent("acceptevt");
    const offerer = await newStudent("accofferer");
    const decliner = await newStudent("accdecl");
    const third = await newStudent("accthird");
    const other = await newStudent("accother");
    const names = await Promise.all([poster, offerer, decliner, third, other].map((c) => usernameOf(c)));
    const message = "distinctive-accept-text-24680";
    const post = async (cookie: string, leaving: string, join: string[]) => {
      expect((await submitPost(cookie, { leaving, join, message })).status).toBe(303);
      return (await ownPostId(cookie)) as number;
    };
    const posterPost = await post(poster, MON_14, [WED_9, WED_1030]);
    const offererPost = await post(offerer, WED_9, [MON_14]);
    const otherPost = await post(other, WED_14, [WED_1530]);
    expect((await submitOffer(offerer, posterPost, { class: WED_9 })).status).toBe(303);
    expect((await submitOffer(decliner, posterPost, { class: WED_1030 })).status).toBe(303);
    // the poster has an offer on another post, which the accept closes
    expect((await submitOffer(poster, otherPost, { class: WED_1530 })).status).toBe(303);
    expect((await submitOffer(third, offererPost, { class: MON_14 })).status).toBe(303);
    const [first, second] = await offerIdsOn(poster, posterPost);

    const controller = new AbortController();
    const res = await fetch(new URL("/api/events", baseUrl), { signal: controller.signal });
    const stream = (res.body as ReadableStream<Uint8Array>).getReader();
    try {
      await readUntil(stream, (seen) => seen.includes(": connected"));
      // refused answers change nothing and send nothing
      expect((await acceptOffer(offerer, first)).status).toBe(403);
      expect((await declineOffer(other, second, "/")).status).toBe(403);
      expect((await acceptOffer(poster, first, { confirm: false })).status).toBe(400);

      expect((await declineOffer(poster, second, "/")).status).toBe(303);
      expect((await acceptOffer(poster, first)).status).toBe(303);

      const ids = [posterPost, offererPost, otherPost];
      const raw = await readUntil(stream, (seen) => ids.every((id) => seen.includes(`"postId":${id},`)));
      const eventsFor = (id: number) =>
        raw
          .split("\n")
          .filter((l) => l.startsWith("data: ") && l.includes(`"postId":${id},`))
          .map((l) => JSON.parse(l.slice(6)));
      // the swapped post: the decline, then one "swapped" for the accept (its
      // other offers closing adds nothing more for the same post)
      expect(eventsFor(posterPost)).toEqual([
        { type: "post-changed", postId: posterPost, kind: "offer-declined" },
        { type: "post-changed", postId: posterPost, kind: "swapped" },
      ]);
      // the offerer's own post was withdrawn by the swap
      expect(eventsFor(offererPost)).toEqual([{ type: "post-changed", postId: offererPost, kind: "withdrawn" }]);
      // a post that only lost an offer
      expect(eventsFor(otherPost)).toEqual([{ type: "post-changed", postId: otherPost, kind: "offer-closed" }]);

      const lower = raw.toLowerCase();
      for (const secret of [...names, message]) expect(lower).not.toContain(secret.toLowerCase());
      for (const c of CLASSES) {
        for (const word of [c.id, c.start, c.end, c.tutor]) expect(lower).not.toContain(word.toLowerCase());
      }
    } finally {
      controller.abort();
    }
  });
});
