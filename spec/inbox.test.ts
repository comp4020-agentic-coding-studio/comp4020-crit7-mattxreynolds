import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { baseUrl, demoCookie, newStudent, page, text, usernameOf } from "./helpers";
import { ROUTES } from "./routes";
import { spawnServer } from "./spawn-server";

// The inbox and the unread count (issue #25, decisions 0033, 0039). Read state
// and ordering are read from the HTML the built server returns.

function send(cookie: string, username: string, body: string, origin = baseUrl): Promise<Response> {
  return fetch(new URL(`/messages/${username}/send`, origin), {
    method: "POST",
    headers: { origin, cookie },
    body: new URLSearchParams({ body }),
    redirect: "manual",
  });
}

async function student(prefix = "ib") {
  const cookie = await newStudent(prefix);
  return { cookie, username: await usernameOf(cookie) };
}

async function sendOk(cookie: string, username: string, body: string, origin = baseUrl) {
  expect((await send(cookie, username, body, origin)).status).toBe(303);
}

/** The header's Messages link, read from a page the viewer loads. */
async function headerLink(path: string, cookie: string, origin = baseUrl) {
  const doc = await page(path, cookie, origin);
  const link = doc.querySelector('nav a[href="/messages/"]');
  return link ? text(link) : null;
}

/** The inbox's conversation rows, in the order shown. */
async function inbox(cookie: string, origin = baseUrl) {
  const doc = await page("/messages/", cookie, origin);
  return [...doc.querySelectorAll("li.conversation")].map((li) => ({
    href: li.querySelector("a")?.getAttribute("href") ?? "",
    other: text(li.querySelector(".conversation-with")),
    preview: text(li.querySelector(".conversation-preview")),
    time: text(li.querySelector("time")),
    datetime: li.querySelector("time")?.getAttribute("datetime") ?? "",
    unread: li.classList.contains("unread"),
  }));
}

const pause = () => new Promise((resolve) => setTimeout(resolve, 15));

/** The login page's demo lines, by student. */
async function demoLines(origin = baseUrl): Promise<Record<string, string>> {
  const doc = await page("/login/", undefined, origin);
  return Object.fromEntries(
    [...doc.querySelectorAll(".demo-students li")]
      .map((li) => text(li.querySelector(".demo-line")))
      .filter(Boolean)
      .map((line) => line.split(": ")),
  );
}

describe("the header's Messages link", () => {
  it("is on every logged-in page, links to the inbox, and reads plain with nothing unread", async () => {
    const a = await student("ibhead");
    for (const path of ["/", "/readme/", "/posts/new/", "/messages/"]) {
      expect(await headerLink(path, a.cookie), path).toBe("Messages");
    }
    expect((await page("/", a.cookie)).querySelector('nav a[href="/messages/"]')?.textContent).toContain("Messages");
  });

  it("is not there for a logged-out visitor", async () => {
    for (const path of ["/", "/readme/", "/login/", "/signup/"]) {
      expect((await page(path)).querySelector('nav a[href="/messages/"]'), path).toBeNull();
    }
  });

  it("counts unread private messages received, on every logged-in page, and not the ones sent", async () => {
    const a = await student("iba");
    const b = await student("ibb");
    await sendOk(b.cookie, a.username, "one");
    await sendOk(b.cookie, a.username, "two");
    await sendOk(a.cookie, b.username, "sent by a");
    for (const path of ["/", "/readme/", "/posts/new/", "/messages/"]) {
      expect(await headerLink(path, a.cookie), path).toBe("Messages (2)");
    }
    expect(await headerLink("/", b.cookie)).toBe("Messages (1)");
  });
});

describe("opening a conversation", () => {
  it("marks only the private messages received there as read", async () => {
    const a = await student("ibrd");
    const b = await student("ibrb");
    const c = await student("ibrc");
    await sendOk(b.cookie, a.username, "b to a, first");
    await sendOk(b.cookie, a.username, "b to a, second");
    await sendOk(a.cookie, b.username, "a to b");
    await sendOk(c.cookie, a.username, "c to a");
    expect(await headerLink("/", a.cookie)).toBe("Messages (3)");
    expect(await headerLink("/", b.cookie)).toBe("Messages (1)");

    // a opens b's conversation: b's two go, c's stays, and the private message
    // a sent b is not a's to mark
    const opened = await page(`/messages/${b.username}/`, a.cookie);
    expect(text(opened.querySelector('nav a[href="/messages/"]'))).toBe("Messages (1)");
    expect(await headerLink("/", a.cookie)).toBe("Messages (1)");
    expect(await headerLink("/", b.cookie)).toBe("Messages (1)");
    expect(await headerLink("/", c.cookie)).toBe("Messages");

    await page(`/messages/${c.username}/`, a.cookie);
    expect(await headerLink("/", a.cookie)).toBe("Messages");
    expect(await headerLink("/", b.cookie)).toBe("Messages (1)");

    await page(`/messages/${a.username}/`, b.cookie);
    expect(await headerLink("/", b.cookie)).toBe("Messages");
  });

  it("marks nothing when the address is unknown or your own", async () => {
    const a = await student("ibn");
    const b = await student("ibnb");
    await sendOk(b.cookie, a.username, "hello");
    expect((await fetch(new URL(`/messages/${a.username}/`, baseUrl), { headers: { cookie: a.cookie } })).status).toBe(404);
    expect((await fetch(new URL("/messages/nobody-here-9/", baseUrl), { headers: { cookie: a.cookie } })).status).toBe(404);
    expect(await headerLink("/", a.cookie)).toBe("Messages (1)");
  });

  it("is not done by the conversation's refetch route", async () => {
    const a = await student("ibf");
    const b = await student("ibfb");
    await sendOk(b.cookie, a.username, "hello");
    const res = await fetch(new URL(`/fragments/messages/${b.username}/`, baseUrl), { headers: { cookie: a.cookie } });
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("hello");
    expect(await headerLink("/", a.cookie)).toBe("Messages (1)");
  });

  it("is not done by loading the inbox", async () => {
    const a = await student("ibi");
    const b = await student("ibib");
    await sendOk(b.cookie, a.username, "hello");
    await page("/messages/", a.cookie);
    expect(await headerLink("/messages/", a.cookie)).toBe("Messages (1)");
  });
});

describe("the inbox", () => {
  it("lists conversations most recent activity first, each with the other username, a preview and a time", async () => {
    const a = await student("ibo");
    const b = await student("ibob");
    const c = await student("iboc");
    const d = await student("ibod");
    const stamp = (): Promise<number> => pause().then(() => Date.now());

    const t0 = await stamp();
    await sendOk(b.cookie, a.username, "b first");
    await pause();
    await sendOk(c.cookie, a.username, "c only");
    await pause();
    await sendOk(a.cookie, d.username, "a to d");
    const t1 = await stamp();
    expect((await inbox(a.cookie)).map((r) => r.other)).toEqual([d.username, c.username, b.username]);

    // a new private message moves its conversation to the top
    await pause();
    await sendOk(b.cookie, a.username, "b again,\nover two lines");
    const t2 = await stamp();
    const rows = await inbox(a.cookie);
    expect(rows.map((r) => r.other)).toEqual([b.username, d.username, c.username]);
    expect(rows.map((r) => r.href)).toEqual([
      `/messages/${b.username}/`,
      `/messages/${d.username}/`,
      `/messages/${c.username}/`,
    ]);

    // the preview is the last private message, whoever sent it
    expect(rows.map((r) => r.preview)).toEqual(["b again, over two lines", "a to d", "c only"]);
    // and the time is when that one was sent, in Canberra time: the clock part
    // is worked out here with Intl directly, not with the page's formatter
    const clock = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Australia/Canberra",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    });
    for (const row of rows) {
      expect(row.time).toMatch(/^[A-Z][a-z]{2} \d{1,2} [A-Z][a-z]{2}, \d{2}:\d{2}$/);
      expect(row.time.endsWith(clock.format(new Date(row.datetime)))).toBe(true);
    }
    expect(new Date(rows[0]?.datetime ?? "").getTime()).toBeGreaterThan(t1);
    expect(new Date(rows[0]?.datetime ?? "").getTime()).toBeLessThan(t2);
    expect(new Date(rows[1]?.datetime ?? "").getTime()).toBeGreaterThan(t0);
    expect(new Date(rows[1]?.datetime ?? "").getTime()).toBeLessThan(t1);

    // each conversation is one row, however many private messages it holds
    expect(rows).toHaveLength(3);
  });

  it("cuts a long last private message short and shows a short one whole", async () => {
    const a = await student("ibp");
    const b = await student("ibpb");
    const long = "word ".repeat(100).trim();
    await sendOk(b.cookie, a.username, long);
    const [row] = await inbox(a.cookie);
    expect(row?.preview.endsWith("…")).toBe(true);
    expect(row?.preview.length).toBeLessThan(long.length);
    expect(long.startsWith((row?.preview ?? "").slice(0, -1))).toBe(true);
  });

  it("escapes what a private message says", async () => {
    const a = await student("ibx");
    const b = await student("ibxb");
    await sendOk(b.cookie, a.username, "<b>bold</b> & <script>1</script>");
    const doc = await page("/messages/", a.cookie);
    expect(doc.querySelector("li.conversation b")).toBeNull();
    expect(doc.querySelector("li.conversation script")).toBeNull();
    expect(text(doc.querySelector(".conversation-preview"))).toBe("<b>bold</b> & <script>1</script>");
  });

  it("marks a conversation with unread private messages, and only that one, until it is opened", async () => {
    const a = await student("ibu");
    const b = await student("ibub");
    const c = await student("ibuc");
    const d = await student("ibud");
    await sendOk(b.cookie, a.username, "unread from b");
    await pause();
    await sendOk(c.cookie, a.username, "unread from c");
    await pause();
    await sendOk(a.cookie, d.username, "a to d, nothing back");
    const flags = async () => Object.fromEntries((await inbox(a.cookie)).map((r) => [r.other, r.unread]));
    expect(await flags()).toEqual({ [b.username]: true, [c.username]: true, [d.username]: false });

    await page(`/messages/${c.username}/`, a.cookie);
    expect(await flags()).toEqual({ [b.username]: true, [c.username]: false, [d.username]: false });

    // an unread one arriving later makes an opened conversation bold again
    await pause();
    await sendOk(c.cookie, a.username, "c again");
    expect(await flags()).toEqual({ [b.username]: true, [c.username]: true, [d.username]: false });
  });

  it("says how conversations start when there are none, as noah on a fresh database", async () => {
    const dbPath = join(mkdtempSync(join(tmpdir(), "inbox-empty-")), "test.db");
    const server = await spawnServer(dbPath);
    try {
      const noah = await demoCookie("Noah", server.baseUrl);
      const doc = await page("/messages/", noah, server.baseUrl);
      expect(doc.querySelectorAll("li.conversation")).toHaveLength(0);
      const empty = text(doc.querySelector(".no-conversations"));
      expect(empty).toMatch(/no conversations/i);
      expect(empty).toContain("Message");
      expect(empty).toMatch(/post page/i);
      expect(text(doc.querySelector('nav a[href="/messages/"]'))).toBe("Messages");

      // and it is not the message shown once there is one
      const sam = await demoCookie("Sam", server.baseUrl);
      await sendOk(sam, "Noah", "hello noah", server.baseUrl);
      const after = await page("/messages/", noah, server.baseUrl);
      expect(after.querySelector(".no-conversations")).toBeNull();
      expect(after.querySelectorAll("li.conversation")).toHaveLength(1);
    } finally {
      await server.stop();
    }
  }, 60_000);

  it("shows the viewer only their own conversations", async () => {
    const a = await student("ibs");
    const b = await student("ibsb");
    const c = await student("ibsc");
    await sendOk(a.cookie, b.username, "secret-between-a-and-b");
    await sendOk(b.cookie, a.username, "secret-reply-from-b");
    await sendOk(c.cookie, a.username, "c to a");

    const bRows = await inbox(b.cookie);
    expect(bRows.map((r) => r.other)).toEqual([a.username]);
    const cRows = await inbox(c.cookie);
    expect(cRows.map((r) => r.other)).toEqual([a.username]);
    expect(cRows[0]?.preview).toBe("c to a");

    // a student in none of them sees none of them, and none of their text
    const d = await student("ibsd");
    const raw = await (await fetch(new URL("/messages/", baseUrl), { headers: { cookie: d.cookie } })).text();
    for (const secret of [a.username, b.username, c.username, "secret-between-a-and-b", "secret-reply-from-b", "c to a"]) {
      expect(raw, secret).not.toContain(secret);
    }
    expect(await inbox(d.cookie)).toEqual([]);
  });

  it("sends a logged-out visitor to the login page", async () => {
    const res = await fetch(new URL("/messages/", baseUrl), { redirect: "manual" });
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toContain("/login/");
  });

  it("is in route coverage", () => {
    expect(ROUTES).toContain("/messages/");
  });
});

describe("the seeded unread private message (0038, 0033)", () => {
  it("shows alex Messages (1) on a fresh database, and opening the priya conversation clears it", async () => {
    const dbPath = join(mkdtempSync(join(tmpdir(), "inbox-seed-")), "test.db");
    const server = await spawnServer(dbPath);
    try {
      const alex = await demoCookie("Alex", server.baseUrl);
      expect(await headerLink("/", alex, server.baseUrl)).toBe("Messages (1)");
      const rows = await inbox(alex, server.baseUrl);
      expect(rows.map((r) => [r.other, r.unread])).toEqual([["Priya", true]]);
      expect(rows[0]?.preview).toContain("Hi Alex");

      await page("/messages/priya/", alex, server.baseUrl);
      expect(await headerLink("/", alex, server.baseUrl)).toBe("Messages");
      expect((await inbox(alex, server.baseUrl)).map((r) => [r.other, r.unread])).toEqual([["Priya", false]]);

      // the read conversation between jordan and mei was never counted
      const mei = await demoCookie("Mei", server.baseUrl);
      expect(await headerLink("/", mei, server.baseUrl)).toBe("Messages");
      expect((await inbox(mei, server.baseUrl)).map((r) => [r.other, r.unread])).toEqual([["Jordan", false]]);
    } finally {
      await server.stop();
    }
  }, 60_000);
});

describe("the login page's demo lines (0039)", () => {
  it("gain the unread part, as counts only, and it follows what is read", async () => {
    const dbPath = join(mkdtempSync(join(tmpdir(), "inbox-lines-")), "test.db");
    const server = await spawnServer(dbPath);
    try {
      const lines = await demoLines(server.baseUrl);
      expect(lines.Alex).toBe("2 offers to answer · 1 unread message");
      // the seeded read messages count for nobody
      for (const name of ["Priya", "Sam", "Lena", "Jordan", "Mei", "Noah", "Zara"]) {
        expect(lines[name], name).not.toContain("unread");
      }

      // it is live: two more for sam, and the part is plural; alex reads his
      const fresh = await newStudent("ibl", server.baseUrl);
      await sendOk(fresh, "Sam", "first secret-line-text", server.baseUrl);
      await sendOk(fresh, "Sam", "second secret-line-text", server.baseUrl);
      await sendOk(fresh, "Noah", "third secret-line-text", server.baseUrl);
      const alex = await demoCookie("Alex", server.baseUrl);
      await page("/messages/priya/", alex, server.baseUrl);
      const after = await demoLines(server.baseUrl);
      expect(after.Alex).toBe("2 offers to answer");
      expect(after.Sam).toBe("1 pending offer · 2 unread messages");
      // "no post yet" is only said when there is nothing else to say (0039)
      expect(after.Noah).toBe("1 unread message");

      // counts only: no message text, no other student's username
      const raw = await (await fetch(new URL("/login/", server.baseUrl))).text();
      expect(raw).not.toContain("secret-line-text");
      expect(raw).not.toContain("Hi Alex");
      expect(after.Sam).not.toContain(await usernameOf(fresh, server.baseUrl));
    } finally {
      await server.stop();
    }
  }, 60_000);
});
