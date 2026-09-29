import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";
import { CLASSES } from "../src/lib/classes";
import {
  acceptOffer,
  baseUrl,
  demoCookie,
  newStudent,
  offerIdsOn,
  ownPostId,
  page,
  submitOffer,
  submitPost,
  text,
  usernameOf,
  withdrawPost,
} from "./helpers";
import { spawnServer } from "./spawn-server";

// Comments on a swap post (issue #23, decisions 0026, 0027, 0028, 0029, 0038,
// 0043, 0045). Every rule is server-enforced and every view is read from the
// HTML the built server returns.
const [MON_14, , WED_9, WED_1030] = CLASSES.map((c) => c.id);

function submitComment(cookie: string | null, postId: number | string, body?: string, next?: string): Promise<Response> {
  const form = new URLSearchParams();
  if (body !== undefined) form.set("body", body);
  if (next !== undefined) form.set("next", next);
  return fetch(new URL(`/posts/${postId}/comments`, baseUrl), {
    method: "POST",
    headers: cookie ? { origin: baseUrl, cookie } : { origin: baseUrl },
    body: form,
    redirect: "manual",
  });
}

function submitDelete(cookie: string | null, commentId: number | string, next?: string): Promise<Response> {
  const form = new URLSearchParams();
  if (next !== undefined) form.set("next", next);
  return fetch(new URL(`/comments/${commentId}/delete`, baseUrl), {
    method: "POST",
    headers: cookie ? { origin: baseUrl, cookie } : { origin: baseUrl },
    body: form,
    redirect: "manual",
  });
}

async function poster() {
  const cookie = await newStudent("cposter");
  expect((await submitPost(cookie, { leaving: MON_14, join: [WED_9, WED_1030], message: "Comment on me." })).status).toBe(303);
  const id = await ownPostId(cookie);
  if (id === null) throw new Error("the post did not appear");
  return { cookie, id, username: await usernameOf(cookie), path: `/posts/${id}/` };
}

async function student(prefix = "commenter") {
  const cookie = await newStudent(prefix);
  return { cookie, username: await usernameOf(cookie) };
}

/** The thread as the post page shows it: one entry per comment, in order. */
async function thread(path: string, cookie: string) {
  const doc = await page(path, cookie);
  return [...doc.querySelectorAll(".comment-list .comment")].map((li) => ({
    text: text(li),
    author: text(li.querySelector("strong")),
    body: li.querySelector(".comment-body")?.textContent ?? null,
    poster: li.querySelector(".poster-tag") !== null,
    time: li.querySelector("time")?.textContent ?? null,
    deleteAction: li.querySelector('form[action$="/delete"]')?.getAttribute("action") ?? null,
    deleted: li.classList.contains("deleted"),
  }));
}

/** The id of the comment `cookie`'s student can delete on this page (their newest). */
async function ownCommentId(path: string, cookie: string): Promise<number> {
  const rows = await thread(path, cookie);
  const action = [...rows].reverse().find((r) => r.deleteAction)?.deleteAction;
  const id = action?.match(/^\/comments\/(\d+)\/delete$/)?.[1];
  if (!id) throw new Error("no deletable comment on the page");
  return Number(id);
}

async function commentBox(path: string, cookie: string): Promise<boolean> {
  return (await page(path, cookie)).querySelector('form[action$="/comments"] textarea') !== null;
}

/** The board's "N comments" line for post `postId`, as `cookie` sees the board. */
async function boardCount(postId: number, cookie: string): Promise<string | null> {
  const doc = await page("/", cookie);
  const article = [...doc.querySelectorAll("article.post")].find((a) => a.querySelector(`a[href="/posts/${postId}/"]`));
  return article ? text(article.querySelector(".comment-count")) : null;
}

/** A poster and an offerer whose offer the poster accepted: the post is swapped. */
async function swappedPost() {
  const p = await poster();
  const o = await student("cofferer");
  expect((await submitOffer(o.cookie, p.id, { class: WED_9 })).status).toBe(303);
  const [offerId] = await offerIdsOn(p.cookie, p.id);
  expect((await acceptOffer(p.cookie, offerId)).status).toBe(303);
  return { p, o };
}

async function readUntil(stream: ReadableStreamDefaultReader<Uint8Array>, done: (seen: string) => boolean, ms = 5000) {
  const decoder = new TextDecoder();
  let seen = "";
  const deadline = Date.now() + ms;
  while (!done(seen)) {
    const left = deadline - Date.now();
    if (left <= 0) throw new Error(`stream did not deliver what was expected within ${ms}ms; saw: ${seen}`);
    const chunk = await Promise.race([stream.read(), new Promise<null>((resolve) => setTimeout(() => resolve(null), left))]);
    if (chunk === null || chunk.done) continue;
    seen += decoder.decode(chunk.value);
  }
  return seen;
}

describe("commenting", () => {
  it("shows the comment after a reload with its author and time, and a poster tag only on the poster's", async () => {
    const p = await poster();
    const c = await student();
    expect((await submitComment(c.cookie, p.id, "Is Wed 09:00 still free?", p.path)).status).toBe(303);
    expect((await submitComment(p.cookie, p.id, "Yes it is.", p.path)).status).toBe(303);

    for (const viewer of [c.cookie, p.cookie]) {
      const rows = await thread(p.path, viewer);
      expect(rows.map((r) => [r.author, r.body, r.poster])).toEqual([
        [c.username, "Is Wed 09:00 still free?", false],
        [p.username, "Yes it is.", true],
      ]);
      // "Mon 28 Sep, 14:05", Canberra time (0046)
      for (const row of rows) expect(row.time).toMatch(/^[A-Z][a-z]{2} \d{1,2} [A-Z][a-z]{2}, \d{2}:\d{2}$/);
    }
  });

  it("keeps the thread oldest first and the text exactly as written: escaped, with its line breaks", async () => {
    const p = await poster();
    const c = await student();
    const tricky = "first line\r\nsecond <b>line</b> & \"quotes\"\n  indented";
    await submitComment(c.cookie, p.id, "one", p.path);
    await submitComment(c.cookie, p.id, tricky, p.path);
    await submitComment(p.cookie, p.id, "three", p.path);

    const rows = await thread(p.path, c.cookie);
    expect(rows.map((r) => r.body)).toEqual(["one", 'first line\nsecond <b>line</b> & "quotes"\n  indented', "three"]);
    const doc = await page(p.path, c.cookie);
    expect(doc.querySelector(".comment-body b")).toBeNull();
  });

  it("shows the thread and the box below the post, and below the offers for the poster", async () => {
    const p = await poster();
    const o = await student("cofferer");
    await submitOffer(o.cookie, p.id, { class: WED_9 });
    await submitComment(o.cookie, p.id, "hello", p.path);

    const doc = await page(p.path, p.cookie);
    const order = (a: Element | null, b: Element | null) =>
      Boolean(a && b && a.compareDocumentPosition(b) & 4 /* b follows a */);
    expect(order(doc.querySelector("#offers"), doc.querySelector("#comments"))).toBe(true);
    expect(order(doc.querySelector("dl"), doc.querySelector("#comments"))).toBe(true);
    expect(order(doc.querySelector("#comments"), doc.querySelector('form[action$="/comments"]'))).toBe(true);
  });

  it("lets the poster comment on their own post, and shows a thread with no comments", async () => {
    const p = await poster();
    expect(text((await page(p.path, p.cookie)).querySelector("#comments")?.parentElement)).toContain("No comments yet.");
    expect((await submitComment(p.cookie, p.id, "Bumping this.", p.path)).status).toBe(303);
    expect((await thread(p.path, p.cookie))[0]?.body).toBe("Bumping this.");
  });

  it("goes back with a 303 to the page it came from, and to the board when `next` is not a path on this site", async () => {
    const p = await poster();
    const c = await student();
    const back = await submitComment(c.cookie, p.id, "one", p.path);
    expect([back.status, new URL(back.headers.get("location") ?? "", baseUrl).pathname]).toEqual([303, p.path]);
    for (const next of [undefined, "https://example.com/", "//example.com/"]) {
      const res = await submitComment(c.cookie, p.id, "two", next);
      expect([res.status, res.headers.get("location")], String(next)).toEqual([303, "/"]);
    }
  });
});

describe("what the server refuses", () => {
  it("rejects an empty, blank or over-500-character comment and accepts exactly 500", async () => {
    const p = await poster();
    const c = await student();
    for (const body of [undefined, "", "   \n\t ", "x".repeat(501), "é".repeat(501), "\n".repeat(499) + "x".repeat(2)]) {
      const res = await submitComment(c.cookie, p.id, body, p.path);
      expect(res.status, JSON.stringify(body)?.slice(0, 20)).toBe(400);
    }
    expect(await thread(p.path, c.cookie)).toEqual([]);

    expect((await submitComment(c.cookie, p.id, "é".repeat(500), p.path)).status).toBe(303);
    expect((await submitComment(c.cookie, p.id, `${"x".repeat(499)}\r\n`.slice(0, 500), p.path)).status).toBe(303);
    expect(await thread(p.path, c.cookie)).toHaveLength(2);
  });

  it("rejects a comment on a post that doesn't exist, or isn't open", async () => {
    const c = await student();
    for (const id of [999999, "abc"]) expect((await submitComment(c.cookie, id, "hi")).status).toBe(404);

    const withdrawn = await poster();
    expect((await withdrawPost(withdrawn.cookie, withdrawn.id, withdrawn.path)).status).toBe(303);
    expect((await submitComment(c.cookie, withdrawn.id, "too late")).status).toBe(409);
    expect((await submitComment(withdrawn.cookie, withdrawn.id, "too late")).status).toBe(409);

    const { p } = await swappedPost();
    expect((await submitComment(c.cookie, p.id, "too late")).status).toBe(409);
    expect(await thread(withdrawn.path, c.cookie)).toEqual([]);
    expect(await thread(p.path, c.cookie)).toEqual([]);
  });

  it("rejects a comment or a delete from a logged-out visitor, and changes nothing", async () => {
    const p = await poster();
    const c = await student();
    await submitComment(c.cookie, p.id, "mine", p.path);
    const id = await ownCommentId(p.path, c.cookie);

    const comment = await submitComment(null, p.id, "sneaky", p.path);
    const removal = await submitDelete(null, id, p.path);
    for (const res of [comment, removal]) {
      expect(res.status).toBeGreaterThanOrEqual(300);
      expect(res.headers.get("location") ?? "").toContain("/login/");
    }
    expect((await thread(p.path, c.cookie)).map((r) => [r.body, r.deleted])).toEqual([["mine", false]]);
  });

  it("rejects a delete by anyone but the author, the poster included", async () => {
    const p = await poster();
    const c = await student();
    const other = await student("cother");
    await submitComment(c.cookie, p.id, "keep me", p.path);
    const id = await ownCommentId(p.path, c.cookie);

    expect((await submitDelete(p.cookie, id, p.path)).status).toBe(403);
    expect((await submitDelete(other.cookie, id, p.path)).status).toBe(403);
    expect((await submitDelete(c.cookie, 999999, p.path)).status).toBe(404);
    expect((await thread(p.path, c.cookie)).map((r) => r.body)).toEqual(["keep me"]);
    // only the author is offered the button
    expect((await thread(p.path, p.cookie))[0]?.deleteAction).toBeNull();
    expect((await thread(p.path, other.cookie))[0]?.deleteAction).toBeNull();
    expect((await thread(p.path, c.cookie))[0]?.deleteAction).toBe(`/comments/${id}/delete`);
  });

  it("rejects a second delete, and a delete once the post is withdrawn", async () => {
    const p = await poster();
    const c = await student();
    await submitComment(c.cookie, p.id, "first", p.path);
    const id = await ownCommentId(p.path, c.cookie);
    expect((await submitDelete(c.cookie, id, p.path)).status).toBe(303);
    expect((await submitDelete(c.cookie, id, p.path)).status).toBe(409);

    await submitComment(c.cookie, p.id, "second", p.path);
    const second = await ownCommentId(p.path, c.cookie);
    expect((await withdrawPost(p.cookie, p.id, p.path)).status).toBe(303);
    expect((await submitDelete(c.cookie, second, p.path)).status).toBe(409);
    expect((await thread(p.path, c.cookie)).map((r) => r.body)).toEqual([null, "second"]);
  });

  it("rejects a delete on a swapped post", async () => {
    const p = await poster();
    const o = await student("cofferer");
    await submitComment(o.cookie, p.id, "before the swap", p.path);
    const id = await ownCommentId(p.path, o.cookie);
    expect((await submitOffer(o.cookie, p.id, { class: WED_9 })).status).toBe(303);
    const [offerId] = await offerIdsOn(p.cookie, p.id);
    expect((await acceptOffer(p.cookie, offerId)).status).toBe(303);
    expect((await submitDelete(o.cookie, id, p.path)).status).toBe(409);
    expect((await thread(p.path, o.cookie)).map((r) => r.body)).toEqual(["before the swap"]);
  });
});

describe("a deleted comment", () => {
  it("shows Comment deleted with no author or text, in its place, and the text is in no response", async () => {
    const p = await poster();
    const c = await student("cdeleter");
    const secret = "distinctive-deleted-text-31337";
    await submitComment(p.cookie, p.id, "first", p.path);
    await submitComment(c.cookie, p.id, secret, p.path);
    await submitComment(p.cookie, p.id, "third", p.path);
    const id = await ownCommentId(p.path, c.cookie);

    // read the public stream across the delete
    const controller = new AbortController();
    const stream = (await fetch(new URL("/api/events", baseUrl), { signal: controller.signal })).body?.getReader();
    if (!stream) throw new Error("no stream");
    try {
      await readUntil(stream, (seen) => seen.includes(": connected"));
      expect((await submitDelete(c.cookie, id, p.path)).status).toBe(303);
      const raw = await readUntil(stream, (seen) => seen.includes(`"postId":${p.id},"kind":"comment-deleted"`));
      expect(raw).not.toContain(secret);
      expect(raw.toLowerCase()).not.toContain(c.username.toLowerCase());
    } finally {
      controller.abort();
    }

    const rows = await thread(p.path, p.cookie);
    expect(rows.map((r) => r.deleted ? "Comment deleted" : r.body)).toEqual(["first", "Comment deleted", "third"]);
    expect(rows[1]).toMatchObject({ text: "Comment deleted", author: "", poster: false, time: null, deleteAction: null });

    // page, refetch and board, for the author, the poster and a bystander
    const bystander = await student();
    for (const cookie of [c.cookie, p.cookie, bystander.cookie]) {
      for (const path of [p.path, `/fragments/posts/${p.id}/`, "/"]) {
        const body = await (await fetch(new URL(path, baseUrl), { headers: { cookie } })).text();
        expect(body, path).not.toContain(secret);
      }
    }
    const postPage = await (await fetch(new URL(p.path, baseUrl), { headers: { cookie: bystander.cookie } })).text();
    expect(postPage).not.toContain(c.username);
  });
});

describe("the board's comment count", () => {
  it("counts comments and leaves out deleted ones, for everyone, on the post's own entry too", async () => {
    const p = await poster();
    const c = await student();
    const bystander = await student();
    expect(await boardCount(p.id, bystander.cookie)).toBe("0 comments");
    await submitComment(c.cookie, p.id, "one", p.path);
    expect(await boardCount(p.id, bystander.cookie)).toBe("1 comment");
    await submitComment(p.cookie, p.id, "two", p.path);
    await submitComment(c.cookie, p.id, "three", p.path);
    expect(await boardCount(p.id, bystander.cookie)).toBe("3 comments");
    expect(await boardCount(p.id, p.cookie)).toBe("3 comments");

    await submitDelete(c.cookie, await ownCommentId(p.path, c.cookie), p.path);
    expect(await boardCount(p.id, bystander.cookie)).toBe("2 comments");
    expect(await boardCount(p.id, p.cookie)).toBe("2 comments");
  });

  it("is what the board fragment carries too", async () => {
    const p = await poster();
    const c = await student();
    await submitComment(c.cookie, p.id, "one", p.path);
    const html = await (await fetch(new URL("/fragments/board/", baseUrl), { headers: { cookie: c.cookie } })).text();
    expect(html).toContain("1 comment");
  });
});

describe("a withdrawn or swapped post", () => {
  it("shows its comments read-only: no box, no delete", async () => {
    const p = await poster();
    const c = await student();
    await submitComment(c.cookie, p.id, "kept", p.path);
    await submitComment(p.cookie, p.id, "also kept", p.path);
    expect(await commentBox(p.path, c.cookie)).toBe(true);
    expect((await thread(p.path, c.cookie))[0]?.deleteAction).not.toBeNull();
    expect((await withdrawPost(p.cookie, p.id, p.path)).status).toBe(303);

    for (const cookie of [c.cookie, p.cookie]) {
      expect((await thread(p.path, cookie)).map((r) => r.body)).toEqual(["kept", "also kept"]);
      expect(await commentBox(p.path, cookie)).toBe(false);
      expect((await thread(p.path, cookie)).every((r) => r.deleteAction === null)).toBe(true);
    }
  });

  it("does the same once swapped", async () => {
    const p = await poster();
    const o = await student("cofferer");
    await submitComment(o.cookie, p.id, "before the swap", p.path);
    expect((await submitOffer(o.cookie, p.id, { class: WED_9 })).status).toBe(303);
    const [offerId] = await offerIdsOn(p.cookie, p.id);
    expect((await acceptOffer(p.cookie, offerId)).status).toBe(303);

    for (const cookie of [o.cookie, p.cookie]) {
      expect((await thread(p.path, cookie)).map((r) => r.body)).toEqual(["before the swap"]);
      expect(await commentBox(p.path, cookie)).toBe(false);
      expect((await thread(p.path, cookie))[0]?.deleteAction).toBeNull();
    }
  });
});

describe("/api/events", () => {
  it("says post N changed when a comment is added and deleted, with no comment text or username", async () => {
    const p = await poster();
    const c = await student("cstreamer");
    const body = "distinctive-comment-text-24680";

    const controller = new AbortController();
    const stream = (await fetch(new URL("/api/events", baseUrl), { signal: controller.signal })).body?.getReader();
    if (!stream) throw new Error("no stream");
    try {
      await readUntil(stream, (seen) => seen.includes(": connected"));
      expect((await submitComment(c.cookie, p.id, body, p.path)).status).toBe(303);
      let raw = await readUntil(stream, (seen) => seen.includes(`"postId":${p.id},"kind":"comment-added"`));
      expect((await submitDelete(c.cookie, await ownCommentId(p.path, c.cookie), p.path)).status).toBe(303);
      raw += await readUntil(stream, (seen) => seen.includes(`"postId":${p.id},"kind":"comment-deleted"`));

      const lines = raw.split("\n").filter((l) => l.startsWith("data: ") && l.includes(`"postId":${p.id},`));
      expect(lines.map((l) => JSON.parse(l.slice(6)))).toEqual([
        { type: "post-changed", postId: p.id, kind: "comment-added" },
        { type: "post-changed", postId: p.id, kind: "comment-deleted" },
      ]);
      expect(raw.toLowerCase()).not.toContain(body);
      expect(raw.toLowerCase()).not.toContain(c.username.toLowerCase());
    } finally {
      controller.abort();
    }
  });

  it("says nothing when a refused comment changes nothing", async () => {
    const p = await poster();
    const c = await student();
    const controller = new AbortController();
    const stream = (await fetch(new URL("/api/events", baseUrl), { signal: controller.signal })).body?.getReader();
    if (!stream) throw new Error("no stream");
    try {
      await readUntil(stream, (seen) => seen.includes(": connected"));
      expect((await submitComment(c.cookie, p.id, "", p.path)).status).toBe(400);
      const marker = await student();
      await submitComment(marker.cookie, p.id, "marker", p.path);
      const raw = await readUntil(stream, (seen) => seen.includes(`"postId":${p.id},`));
      expect(raw.match(new RegExp(`"postId":${p.id},`, "g"))).toHaveLength(1);
    } finally {
      controller.abort();
    }
  });
});

describe("the post fragment", () => {
  it("carries the thread for the viewer, with the delete button only for the author, and no comment box", async () => {
    const p = await poster();
    const c = await student();
    await submitComment(c.cookie, p.id, "in the thread", p.path);
    const get = async (cookie: string) =>
      (await fetch(new URL(`/fragments/posts/${p.id}/`, baseUrl), { headers: { cookie } })).text();
    const mine = await get(c.cookie);
    expect(mine).toContain("in the thread");
    expect(mine).toContain("/delete");
    expect(mine).not.toContain("<textarea");
    expect(await get(p.cookie)).not.toContain("/delete");
  });
});

describe("the demo seed's comments", () => {
  it("gives alex's post two comments (sam asks, alex replies) and jordan's swapped post mei's, before the swap", async () => {
    const dbPath = join(mkdtempSync(join(tmpdir(), "comments-seed-")), "test.db");
    const server = await spawnServer(dbPath);
    try {
      const db = new Database(dbPath, { readonly: true });
      const rows = db
        .prepare(
          `select p.id as post, poster.username as poster, a.username as author, c.body, c.created_at, c.deleted_at, p.status,
                  (select o.resolved_at from offers o where o.post_id = p.id and o.status = 'accepted') as swapped_at,
                  p.posted_at
             from comments c
             join swap_posts p on p.id = c.post_id
             join students poster on poster.id = p.student_id
             join students a on a.id = c.author_id
            order by c.created_at`,
        )
        .all() as {
        post: number;
        poster: string;
        author: string;
        body: string;
        created_at: number;
        deleted_at: number | null;
        status: string;
        swapped_at: number | null;
        posted_at: number;
      }[];
      db.close();

      expect(rows.filter((r) => r.poster === "alex").map((r) => r.author)).toEqual(["sam", "alex"]);
      const mei = rows.filter((r) => r.poster === "jordan");
      expect(mei.map((r) => r.author)).toEqual(["mei"]);
      expect(mei[0]?.status).toBe("swapped");
      expect(mei[0]?.created_at).toBeLessThan(mei[0]?.swapped_at ?? 0);
      expect(mei[0]?.created_at).toBeGreaterThan(mei[0]?.posted_at ?? Infinity);
      expect(rows).toHaveLength(3);
      for (const row of rows) {
        expect(row.deleted_at).toBeNull();
        expect(row.created_at).toBeGreaterThan(row.posted_at);
        expect(row.created_at).toBeLessThan(Date.now());
      }

      // and through the app: alex's board line and post page, and jordan's post
      const alex = await demoCookie("alex", server.baseUrl);
      const board = await page("/", alex, server.baseUrl);
      expect(text(board.querySelector("#your-post ~ .post .comment-count"))).toBe("2 comments");
      const alexPostId = rows.find((r) => r.poster === "alex")?.post;
      const doc = await page(`/posts/${alexPostId}/`, alex, server.baseUrl);
      const entries = [...doc.querySelectorAll(".comment")].map((li) => [
        text(li.querySelector("strong")),
        li.querySelector(".poster-tag") !== null,
      ]);
      expect(entries).toEqual([
        ["sam", false],
        ["alex", true],
      ]);
      const jordanDoc = await page(`/posts/${mei[0]?.post}/`, alex, server.baseUrl);
      expect(text(jordanDoc.querySelector(".comment strong"))).toBe("mei");
      expect(jordanDoc.querySelector('form[action$="/comments"]')).toBeNull();
    } finally {
      await server.stop();
    }
  }, 30_000);
});
