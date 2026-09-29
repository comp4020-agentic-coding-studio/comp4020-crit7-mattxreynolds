import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { CLASSES } from "../src/lib/classes";
import { conversationRefetchOn } from "../src/lib/live";
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
} from "./helpers";
import { spawnServer } from "./spawn-server";

// Private messages (issue #24, decisions 0030, 0031, 0032, 0034, 0035, 0038).
// Every rule is server-enforced and every view is read from the HTML the built
// server returns.
const [MON_14, , WED_9, WED_1030] = CLASSES.map((c) => c.id);

function send(cookie: string | null, username: string, body?: string, origin = baseUrl): Promise<Response> {
  const form = new URLSearchParams();
  if (body !== undefined) form.set("body", body);
  return fetch(new URL(`/messages/${username}/send`, origin), {
    method: "POST",
    headers: cookie ? { origin, cookie } : { origin },
    body: form,
    redirect: "manual",
  });
}

function submitComment(cookie: string, postId: number, body: string): Promise<Response> {
  return fetch(new URL(`/posts/${postId}/comments`, baseUrl), {
    method: "POST",
    headers: { origin: baseUrl, cookie },
    body: new URLSearchParams({ body, next: `/posts/${postId}/` }),
    redirect: "manual",
  });
}

async function student(prefix = "pm", origin = baseUrl) {
  const cookie = await newStudent(prefix, origin);
  return { cookie, username: await usernameOf(cookie, origin) };
}

async function poster() {
  const s = await student("pmposter");
  expect((await submitPost(s.cookie, { leaving: MON_14, join: [WED_9, WED_1030], message: "Message me." })).status).toBe(303);
  const id = await ownPostId(s.cookie);
  if (id === null) throw new Error("the post did not appear");
  return { ...s, id, path: `/posts/${id}/` };
}

/** The conversation as its page shows it: one entry per private message, in order. */
async function thread(username: string, cookie: string, origin = baseUrl) {
  const doc = await page(`/messages/${username}/`, cookie, origin);
  return [...doc.querySelectorAll(".private-message-list .private-message")].map((li) => ({
    sender: text(li.querySelector("strong")),
    body: li.querySelector(".private-message-body")?.textContent ?? null,
    time: li.querySelector("time")?.textContent ?? null,
    instant: li.querySelector("time")?.getAttribute("datetime") ?? null,
  }));
}

/** The usernames a page has "Message" links for, in page order. */
async function messageLinks(path: string, cookie: string): Promise<string[]> {
  const doc = await page(path, cookie);
  return [...doc.querySelectorAll("a.message-link")].map((a) => {
    const href = a.getAttribute("href") ?? "";
    expect(text(a)).toBe("Message");
    expect(a.getAttribute("aria-label")).toBe(`Message ${decodeURIComponent(href.split("/")[2] ?? "")}`);
    return decodeURIComponent(href.match(/^\/messages\/([^/]+)\/$/)?.[1] ?? `BAD ${href}`);
  });
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

/** The stream's parsed `data:` payloads that are "a private message was sent". */
function privateMessageEvents(raw: string): unknown[] {
  return raw
    .split("\n")
    .filter((l) => l.startsWith("data: "))
    .map((l) => JSON.parse(l.slice(6)) as { type?: string })
    .filter((m) => m.type === "private-message");
}

describe("sending a private message", () => {
  it("shows it in the conversation after a reload, for both students, with sender and time", async () => {
    const a = await student();
    const b = await student();
    const before = Date.now();
    expect((await send(a.cookie, b.username, "Are you free Wed?")).status).toBe(303);
    expect((await send(b.cookie, a.username, "Yes, come at 10.")).status).toBe(303);
    const after = Date.now();

    for (const viewer of [a.cookie, b.cookie]) {
      const other = viewer === a.cookie ? b.username : a.username;
      const rows = await thread(other, viewer);
      expect(rows.map((r) => [r.sender, r.body])).toEqual([
        [a.username, "Are you free Wed?"],
        [b.username, "Yes, come at 10."],
      ]);
      for (const row of rows) {
        // "Mon 28 Sep, 14:05", Canberra time (0046)
        expect(row.time).toMatch(/^[A-Z][a-z]{2} \d{1,2} [A-Z][a-z]{2}, \d{2}:\d{2}$/);
        const written = Date.parse(row.instant ?? "");
        expect(written).toBeGreaterThanOrEqual(before);
        expect(written).toBeLessThanOrEqual(after);
      }
    }
  });

  it("keeps the text exactly as written, escaped and with its line breaks, oldest first", async () => {
    const a = await student();
    const b = await student();
    const tricky = "first line\r\nsecond <b>line</b> & \"quotes\"\n  indented";
    await send(a.cookie, b.username, "one");
    await send(a.cookie, b.username, tricky);
    await send(b.cookie, a.username, "three");
    const rows = await thread(b.username, a.cookie);
    expect(rows.map((r) => r.body)).toEqual(["one", 'first line\nsecond <b>line</b> & "quotes"\n  indented', "three"]);
    expect((await page(`/messages/${b.username}/`, a.cookie)).querySelector(".private-message-body b")).toBeNull();
  });

  it("puts the box below the thread, and says so when there is nothing yet", async () => {
    const a = await student();
    const b = await student();
    const doc = await page(`/messages/${b.username}/`, a.cookie);
    expect(text(doc.querySelector("h1"))).toBe(`Conversation with ${b.username}`);
    expect(text(doc.querySelector("#conversation-live"))).toBe("No private messages yet.");
    const box = doc.querySelector(`form[action="/messages/${b.username}/send"] textarea`);
    expect(box?.getAttribute("maxlength")).toBe("500");
    // outside the live-swapped region, so a half-typed private message survives a refresh
    expect(doc.querySelector("#conversation-live")?.contains(box)).toBe(false);
    expect(doc.querySelector("#conversation-live")?.getAttribute("data-live-url")).toBe(`/fragments/messages/${b.username}/`);
  });

  it("returns a 303 to the conversation", async () => {
    const a = await student();
    const b = await student();
    const res = await send(a.cookie, b.username, "hello");
    expect([res.status, res.headers.get("location")]).toEqual([303, `/messages/${b.username}/`]);
  });

  it("is one conversation per pair, whichever student opens it, and separate from every other pair", async () => {
    const a = await student();
    const b = await student();
    const c = await student();
    await send(a.cookie, b.username, "a to b");
    await send(a.cookie, c.username, "a to c");
    expect((await thread(b.username, a.cookie)).map((r) => r.body)).toEqual(["a to b"]);
    expect((await thread(c.username, a.cookie)).map((r) => r.body)).toEqual(["a to c"]);
    expect((await thread(a.username, c.cookie)).map((r) => r.body)).toEqual(["a to c"]);
  });

  it("finds the student whatever the case of the address", async () => {
    const a = await student();
    const b = await student();
    await send(a.cookie, b.username.toUpperCase(), "shouty");
    expect((await thread(b.username.toLowerCase(), a.cookie)).map((r) => r.body)).toEqual(["shouty"]);
    expect((await thread(a.username, b.cookie)).map((r) => r.sender)).toEqual([a.username]);
  });
});

describe("what the server refuses", () => {
  it("rejects an empty, blank or over-500-character private message and accepts exactly 500", async () => {
    const a = await student();
    const b = await student();
    for (const body of [undefined, "", "   \n\t ", "x".repeat(501), "é".repeat(501), "\n".repeat(499) + "x".repeat(2)]) {
      expect((await send(a.cookie, b.username, body)).status, JSON.stringify(body)?.slice(0, 20)).toBe(400);
    }
    expect(await thread(b.username, a.cookie)).toEqual([]);

    expect((await send(a.cookie, b.username, "é".repeat(500))).status).toBe(303);
    expect((await send(a.cookie, b.username, `${"x".repeat(499)}\r\n`.slice(0, 500))).status).toBe(303);
    expect(await thread(b.username, a.cookie)).toHaveLength(2);
  });

  it("rejects one to yourself, and one to an unknown username, and stores neither", async () => {
    const a = await student();
    expect((await send(a.cookie, a.username, "note to self")).status).toBe(400);
    expect((await send(a.cookie, "nobody-here-9", "hello")).status).toBe(404);
    expect((await send(a.cookie, "12345", "hello")).status).toBe(404);
    // the invalid body is checked against a real recipient only: an unknown one is a 404 first
    expect((await send(a.cookie, "nobody-here-9", "")).status).toBe(404);
  });

  it("rejects a private message from a logged-out visitor, and stores nothing", async () => {
    const b = await student();
    const res = await send(null, b.username, "sneaky");
    expect(res.status).toBeGreaterThanOrEqual(300);
    expect(res.headers.get("location") ?? "").toContain("/login/");
    // a fresh student's conversation with b is the only place a stored row could show
    const c = await student();
    expect(await thread(b.username, c.cookie)).toEqual([]);
    expect(await thread(c.username, b.cookie)).toEqual([]);
  });

  it("has no edit or delete route for a private message", async () => {
    const a = await student();
    const b = await student();
    await send(a.cookie, b.username, "permanent");
    for (const path of [`/messages/${b.username}/delete`, `/messages/${b.username}/edit`, "/private-messages/1/delete"]) {
      const res = await fetch(new URL(path, baseUrl), {
        method: "POST",
        headers: { origin: baseUrl, cookie: a.cookie },
        body: new URLSearchParams({ id: "1" }),
        redirect: "manual",
      });
      expect(res.status, path).toBe(404);
    }
    expect((await thread(b.username, a.cookie)).map((r) => r.body)).toEqual(["permanent"]);
  });
});

describe("/messages/<username>/", () => {
  it("is a 404 for an unknown username and for your own, page and refetch", async () => {
    const a = await student();
    for (const username of ["nobody-here-9", a.username, a.username.toUpperCase()]) {
      for (const path of [`/messages/${username}/`, `/fragments/messages/${username}/`]) {
        const res = await fetch(new URL(path, baseUrl), { headers: { cookie: a.cookie } });
        expect(res.status, path).toBe(404);
      }
    }
    const res = await fetch(new URL("/messages/nobody-here-9/", baseUrl), { headers: { cookie: a.cookie } });
    expect(await res.text()).toContain("Conversation not found");
  });

  it("sends a logged-out visitor to the login page, and the refetch route answers 401", async () => {
    const b = await student();
    const page1 = await fetch(new URL(`/messages/${b.username}/`, baseUrl), { redirect: "manual" });
    expect(page1.status).toBeGreaterThanOrEqual(300);
    expect(page1.headers.get("location") ?? "").toContain("/login/");
    const fragment = await fetch(new URL(`/fragments/messages/${b.username}/`, baseUrl), { redirect: "manual" });
    expect(fragment.status).toBe(401);
  });
});

describe("who can read a conversation", () => {
  it("shows a third student nothing of it, through the page or the refetch route", async () => {
    const a = await student();
    const b = await student();
    const c = await student();
    const secret = "distinctive-private-text-77123";
    await send(a.cookie, b.username, secret);
    await send(b.cookie, a.username, `${secret}-reply`);

    // the only addresses c has are "me and a" and "me and b"; neither is a and b's
    for (const other of [a.username, b.username]) {
      expect(await thread(other, c.cookie)).toEqual([]);
      for (const path of [`/messages/${other}/`, `/fragments/messages/${other}/`]) {
        const body = await (await fetch(new URL(path, baseUrl), { headers: { cookie: c.cookie } })).text();
        expect(body, path).not.toContain(secret);
      }
    }
    // and nowhere else c can look
    for (const path of ["/", `/messages/${c.username}/`]) {
      const body = await (await fetch(new URL(path, baseUrl), { headers: { cookie: c.cookie } })).text();
      expect(body, path).not.toContain(secret);
    }
    // the two students see it
    expect(await thread(b.username, a.cookie)).toHaveLength(2);
    expect((await (await fetch(new URL(`/fragments/messages/${a.username}/`, baseUrl), { headers: { cookie: b.cookie } })).text())).toContain(secret);
  });

  it("returns the thread on the refetch route for the viewer only, with no comment box or page around it", async () => {
    const a = await student();
    const b = await student();
    await send(a.cookie, b.username, "in the thread");
    const res = await fetch(new URL(`/fragments/messages/${b.username}/`, baseUrl), { headers: { cookie: a.cookie } });
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    const html = await res.text();
    expect(html).toContain("in the thread");
    expect(html).not.toContain("<textarea");
    expect(html).not.toContain("<html");
  });
});

describe('the "Message" links on a post page (0030)', () => {
  it("appear beside the poster for another student, and not for the poster", async () => {
    const p = await poster();
    const c = await student();
    expect(await messageLinks(p.path, c.cookie)).toEqual([p.username]);
    expect(await messageLinks(p.path, p.cookie)).toEqual([]);
  });

  it("appear beside each commenter, never beside your own comment, and not beside a deleted one", async () => {
    const p = await poster();
    const c = await student();
    const d = await student();
    await submitComment(c.cookie, p.id, "from c");
    await submitComment(d.cookie, p.id, "from d");
    await submitComment(p.cookie, p.id, "from the poster");

    // poster in the definition list, then the thread's authors in order
    expect(await messageLinks(p.path, c.cookie)).toEqual([p.username, d.username, p.username]);
    expect(await messageLinks(p.path, d.cookie)).toEqual([p.username, c.username, p.username]);
    expect(await messageLinks(p.path, p.cookie)).toEqual([c.username, d.username]);

    const doc = await page(p.path, c.cookie);
    const deleteAction = doc.querySelector('form[action$="/delete"]')?.getAttribute("action");
    await fetch(new URL(deleteAction ?? "/x", baseUrl), {
      method: "POST",
      headers: { origin: baseUrl, cookie: c.cookie },
      body: new URLSearchParams({ next: p.path }),
      redirect: "manual",
    });
    expect(await messageLinks(p.path, d.cookie)).toEqual([p.username, p.username]);
  });

  it("appear beside each pending offerer in the poster's view, and no offerer's name is shown to others", async () => {
    const p = await poster();
    const o1 = await student("pmoffer");
    const o2 = await student("pmoffer");
    expect((await submitOffer(o1.cookie, p.id, { class: WED_9 })).status).toBe(303);
    expect((await submitOffer(o2.cookie, p.id, { class: WED_1030 })).status).toBe(303);
    expect((await messageLinks(p.path, p.cookie)).sort()).toEqual([o1.username, o2.username].sort());
    // an offerer sees the poster's link only, and a bystander the same
    expect(await messageLinks(p.path, o1.cookie)).toEqual([p.username]);
    const bystander = await student();
    expect(await messageLinks(p.path, bystander.cookie)).toEqual([p.username]);
    expect(await (await fetch(new URL(p.path, baseUrl), { headers: { cookie: bystander.cookie } })).text()).not.toContain(o1.username);
  });

  it("appear beside both students on a swapped page, except your own name", async () => {
    const p = await poster();
    const o = await student("pmoffer");
    expect((await submitOffer(o.cookie, p.id, { class: WED_9 })).status).toBe(303);
    const [offerId] = await offerIdsOn(p.cookie, p.id);
    expect((await acceptOffer(p.cookie, offerId)).status).toBe(303);

    const bystander = await student();
    expect((await messageLinks(p.path, bystander.cookie)).sort()).toEqual([p.username, o.username].sort());
    // never beside your own name: the poster sees the offerer's alone, the offerer the poster's
    expect(await messageLinks(p.path, p.cookie)).toEqual([o.username]);
    expect(await messageLinks(p.path, o.cookie)).toEqual([p.username]);
  });

  it("appear on a withdrawn post's page beside the poster", async () => {
    const p = await poster();
    const c = await student();
    await fetch(new URL(`/posts/${p.id}/withdraw`, baseUrl), {
      method: "POST",
      headers: { origin: baseUrl, cookie: p.cookie },
      body: new URLSearchParams({ next: p.path }),
      redirect: "manual",
    });
    expect(await messageLinks(p.path, c.cookie)).toEqual([p.username]);
  });

  it("are carried by the post page's refetch too, and lead to the conversation", async () => {
    const p = await poster();
    const c = await student();
    const html = await (await fetch(new URL(`/fragments/posts/${p.id}/`, baseUrl), { headers: { cookie: c.cookie } })).text();
    expect(html).toContain(`href="/messages/${p.username}/"`);
    const res = await fetch(new URL(`/messages/${p.username}/`, baseUrl), { headers: { cookie: c.cookie } });
    expect(res.status).toBe(200);
  });
});

// These count every "a private message was sent" on the stream, and that event
// carries no id to tell whose it is (0034), so they run on a server of their
// own: on the shared one another file's private message can land in the same
// window and make the count two (#43).
describe("/api/events", () => {
  let server: { baseUrl: string; stop: () => Promise<void> } | undefined;
  let origin = "";
  // spawnServer may retry on a new port, so the hook gets longer than the default
  beforeAll(async () => {
    server = await spawnServer(join(mkdtempSync(join(tmpdir(), "spec-pm-events-")), "test.db"));
    origin = server.baseUrl;
  }, 60_000);
  afterAll(() => server?.stop());

  it("says only that a private message was sent, with no text, username or id", async () => {
    const a = await student("pmstreamer", origin);
    const b = await student("pmstreamee", origin);
    const body = "distinctive-private-text-24680";

    const controller = new AbortController();
    const stream = (await fetch(new URL("/api/events", origin), { signal: controller.signal })).body?.getReader();
    if (!stream) throw new Error("no stream");
    try {
      await readUntil(stream, (seen) => seen.includes(": connected"));
      expect((await send(a.cookie, b.username, body, origin)).status).toBe(303);
      const raw = await readUntil(stream, (seen) => seen.includes('"private-message"'));
      expect(privateMessageEvents(raw)).toEqual([{ type: "private-message" }]);
      expect(raw.toLowerCase()).not.toContain(body);
      expect(raw.toLowerCase()).not.toContain(a.username.toLowerCase());
      expect(raw.toLowerCase()).not.toContain(b.username.toLowerCase());
    } finally {
      controller.abort();
    }
  });

  it("says nothing when a refused private message stores nothing", async () => {
    const a = await student("pm", origin);
    const b = await student("pm", origin);
    const controller = new AbortController();
    const stream = (await fetch(new URL("/api/events", origin), { signal: controller.signal })).body?.getReader();
    if (!stream) throw new Error("no stream");
    try {
      await readUntil(stream, (seen) => seen.includes(": connected"));
      expect((await send(a.cookie, b.username, "", origin)).status).toBe(400);
      expect((await send(a.cookie, a.username, "me", origin)).status).toBe(400);
      expect((await send(a.cookie, "nobody-here-9", "hi", origin)).status).toBe(404);
      expect((await send(null, b.username, "hi", origin)).status).toBeGreaterThanOrEqual(300);
      // events arrive in order: by the time the valid one has, a wrongly published one would be in `raw`
      expect((await send(a.cookie, b.username, "marker", origin)).status).toBe(303);
      const raw = await readUntil(stream, (seen) => seen.includes('"private-message"'));
      expect(privateMessageEvents(raw)).toHaveLength(1);
    } finally {
      controller.abort();
    }
  });
});

describe("the conversation's live filter", () => {
  it("refetches on a private message being sent and on nothing else", () => {
    expect(conversationRefetchOn(JSON.stringify({ type: "private-message" }))).toBe(true);
    for (const data of ["", "not json", "null", "7", "[]", JSON.stringify({ type: "post-changed", postId: 1, kind: "created" })]) {
      expect(conversationRefetchOn(data), data).toBe(false);
    }
  });
});

describe("the README (0035)", () => {
  it("carries the sentence about who can read private messages", () => {
    const normalise = (s: string): string => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
    expect(normalise(readFileSync("README.md", "utf8"))).toContain(
      normalise(
        "Private messages can be read only by the two students in the conversation, which for a demo student means anyone. " +
          "They are stored unencrypted, and whoever runs the site can read them.",
      ),
    );
  });
});

describe("the demo seed's private messages (0038)", () => {
  it("has priya's unread message to alex and the jordan/mei conversation after the swap, both read", async () => {
    const dbPath = join(mkdtempSync(join(tmpdir(), "pm-seed-")), "test.db");
    const server = await spawnServer(dbPath);
    try {
      const db = new Database(dbPath, { readonly: true });
      const rows = db
        .prepare(
          `select s.username as sender, r.username as recipient, m.created_at, m.read_at,
                  (select o.resolved_at from offers o join swap_posts p on p.id = o.post_id
                    where o.status = 'accepted' limit 1) as swapped_at
             from private_messages m
             join students s on s.id = m.sender_id
             join students r on r.id = m.recipient_id
            order by m.created_at`,
        )
        .all() as { sender: string; recipient: string; created_at: number; read_at: number | null; swapped_at: number }[];
      db.close();

      expect(rows.map((r) => [r.sender, r.recipient, r.read_at !== null])).toEqual([
        ["Jordan", "Mei", true],
        ["Mei", "Jordan", true],
        ["Priya", "Alex", false],
      ]);
      for (const row of rows) expect(row.created_at).toBeLessThan(Date.now());
      // the conversation is after the swap (0038)
      for (const row of rows.filter((r) => r.sender === "Jordan" || r.sender === "Mei")) {
        expect(row.created_at).toBeGreaterThan(row.swapped_at);
      }

      // and through the app, as each student sees it
      const alex = await demoCookie("Alex", server.baseUrl);
      const fromPriya = await thread("Priya", alex, server.baseUrl);
      expect(fromPriya.map((r) => r.sender)).toEqual(["Priya"]);
      const jordan = await demoCookie("Jordan", server.baseUrl);
      expect((await thread("Mei", jordan, server.baseUrl)).map((r) => r.sender)).toEqual(["Jordan", "Mei"]);
      // noah is in no conversation; alex has none with jordan
      const noah = await demoCookie("Noah", server.baseUrl);
      expect(await thread("Alex", noah, server.baseUrl)).toEqual([]);
      expect(await thread("Jordan", alex, server.baseUrl)).toEqual([]);
    } finally {
      await server.stop();
    }
  }, 30_000);
});
