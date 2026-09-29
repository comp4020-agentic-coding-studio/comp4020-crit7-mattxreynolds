import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";
import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";
import { CLASSES, CLASSES_ACCESSED, classLabel } from "../src/lib/classes";
import { formatCanberra } from "../src/lib/time";
import {
  baseUrl,
  exchangeOf,
  demoCookie,
  newStudent,
  ownPostId,
  page,
  submitPost,
  text,
  usernameOf,
} from "./helpers";
import { spawnServer } from "./spawn-server";

// Posting a swap and seeing it on the board (issue #18, decisions 0016,
// 0017, 0019, 0020, 0038, 0039, 0046, 0047). Every rule is server-enforced
// and visible in the returned HTML, so these go through the built server.
const [MON_14, MON_1530, WED_9, WED_1030, WED_14, WED_1530] = CLASSES.map((c) => c.id);

const OK = { leaving: MON_14, join: [WED_9, WED_1030] };

async function boardEntries(cookie: string, section: "your-post" | "open-posts"): Promise<Element[]> {
  const doc = await page("/", cookie);
  return [...doc.querySelectorAll(`#${section} ~ .post`)];
}

describe("creating a swap post", () => {
  it("lands on the board, and the post is still there on reload", async () => {
    const cookie = await newStudent();
    const username = await usernameOf(cookie);
    const res = await submitPost(cookie, { ...OK, message: "Clashes with my lab." });
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("/");

    // "reload": a fresh request, then the same again from another student
    for (const viewer of [cookie, await newStudent("viewer")]) {
      const doc = await page("/", viewer);
      const entry = [...doc.querySelectorAll(".post")].find((el) => text(el.querySelector("h3")) === username);
      expect(entry, "the post is on the board").toBeTruthy();
      expect(exchangeOf(entry)).toEqual({
        giving: [classLabel(CLASSES[0])],
        lookingFor: [classLabel(CLASSES[2]), classLabel(CLASSES[3])],
        givingFirst: true,
      });
      expect(text(entry)).toContain("Clashes with my lab.");
    }
  });

  it("refuses a post with no join class, and leaves no post behind", async () => {
    const cookie = await newStudent();
    for (const fields of [
      { leaving: MON_14, join: [] },
      { leaving: MON_14, join: [MON_14] },
      { leaving: MON_14, join: [WED_9, MON_14] },
      { leaving: "no-such-class", join: [WED_9] },
      { join: [WED_9] },
      { leaving: MON_14, join: ["no-such-class"] },
      { leaving: MON_14, join: [WED_9], message: "x".repeat(501) },
    ]) {
      const res = await submitPost(cookie, fields);
      expect(res.status, JSON.stringify(fields).slice(0, 80)).toBe(400);
      const doc = new JSDOM(await res.text()).window.document;
      expect(text(doc.querySelector('[role="alert"]')), JSON.stringify(fields).slice(0, 80)).not.toBe("");
    }
    expect(await ownPostId(cookie)).toBeNull();
  });

  it("accepts a message of exactly 500 characters", async () => {
    const cookie = await newStudent();
    const res = await submitPost(cookie, { ...OK, message: "y".repeat(500) });
    expect(res.status).toBe(303);
  });

  it("counts a browser's CRLF line break as one character", async () => {
    const cookie = await newStudent();
    const res = await submitPost(cookie, { ...OK, message: "a\r\n".repeat(250) });
    expect(res.status).toBe(303);
  });

  it("refuses a second open post with a link to the first", async () => {
    const cookie = await newStudent();
    expect((await submitPost(cookie, OK)).status).toBe(303);
    const firstId = await ownPostId(cookie);
    expect(firstId).not.toBeNull();

    const res = await submitPost(cookie, { leaving: MON_1530, join: [WED_14] });
    expect(res.status).toBe(409);
    const doc = new JSDOM(await res.text()).window.document;
    expect(text(doc.querySelector("main"))).toContain("You already have an open post");
    expect(doc.querySelector(`main a[href="/posts/${firstId}/"]`)).toBeTruthy();
  });

  it("lets only one of several posts sent at once through", async () => {
    const cookie = await newStudent();
    const results = await Promise.all([submitPost(cookie, OK), submitPost(cookie, OK), submitPost(cookie, OK)]);
    expect(results.filter((r) => r.status === 303)).toHaveLength(1);
    expect(await boardEntries(cookie, "your-post")).toHaveLength(1);
  });

  it("is backed by the database: a second open post for one student cannot be inserted", async () => {
    const dbPath = join(mkdtempSync(join(tmpdir(), "posts-index-")), "test.db");
    const server = await spawnServer(dbPath);
    await server.stop();
    const db = new Database(dbPath);
    try {
      const noah = db.prepare("select id from students where username = 'noah'").get() as { id: number };
      const insert = db.prepare(
        "insert into swap_posts (student_id, leaving_class_id, posted_at) values (?, 'shitao', ?)",
      );
      insert.run(noah.id, Date.now());
      expect(() => insert.run(noah.id, Date.now())).toThrow(/UNIQUE constraint failed/);
    } finally {
      db.close();
    }
  }, 30_000);

  it("offers the six classes on the form, and needs a login", async () => {
    const cookie = await newStudent();
    const doc = await page("/posts/new/", cookie);
    expect(doc.querySelectorAll('input[name="leaving"]')).toHaveLength(6);
    expect(doc.querySelectorAll('input[name="join"]')).toHaveLength(6);

    const out = await fetch(new URL("/posts/new/", baseUrl), { redirect: "manual" });
    expect(out.status).toBe(302);
    expect(out.headers.get("location")).toContain("/login/");
  });

  it("shows a student with an open post a link to it instead of the form", async () => {
    const cookie = await newStudent();
    await submitPost(cookie, OK);
    const doc = await page("/posts/new/", cookie);
    expect(doc.querySelector("form#post-form")).toBeNull();
    expect(doc.querySelector(`main a[href="/posts/${await ownPostId(cookie)}/"]`)).toBeTruthy();
  });
});

describe("the message", () => {
  it("is shown exactly as written on the post page: escaped, line breaks kept", async () => {
    const cookie = await newStudent();
    const written = `<b>bold?</b> & "quotes"\n\n<script>alert(1)</script>\nlast line`;
    await submitPost(cookie, { ...OK, message: written.replace(/\n/g, "\r\n") });
    const doc = await page(`/posts/${await ownPostId(cookie)}/`, cookie);
    const message = doc.querySelector(".message");
    expect(message?.textContent).toBe(written);
    expect(message?.querySelector("b, script")).toBeNull();
  });

  it("is cut at 120 characters with … on the board, and whole on the post page", async () => {
    const cookie = await newStudent();
    const long = `${"a".repeat(119)}b${"c".repeat(80)}`;
    await submitPost(cookie, { ...OK, message: long });
    const [entry] = await boardEntries(cookie, "your-post");
    expect(entry.querySelector(".message")?.textContent).toBe(`${long.slice(0, 120)}…`);

    const doc = await page(`/posts/${await ownPostId(cookie)}/`, cookie);
    expect(doc.querySelector(".message")?.textContent).toBe(long);
  });

  it("is not cut when it is exactly 120 characters", async () => {
    const cookie = await newStudent();
    const exact = "d".repeat(120);
    await submitPost(cookie, { ...OK, message: exact });
    const [entry] = await boardEntries(cookie, "your-post");
    expect(entry.querySelector(".message")?.textContent).toBe(exact);
  });

  it("shows nothing for a post with no message", async () => {
    const cookie = await newStudent();
    await submitPost(cookie, OK);
    const [entry] = await boardEntries(cookie, "your-post");
    expect(entry.querySelector(".message")).toBeNull();
  });
});

describe("the board", () => {
  it("lists open posts newest first, pins your own under Your post, and shows Post a swap without one", async () => {
    const first = await newStudent("first");
    const second = await newStudent("second");
    const idle = await newStudent("idle");
    const [firstName, secondName] = [await usernameOf(first), await usernameOf(second)];
    await submitPost(first, OK);
    await submitPost(second, { leaving: WED_14, join: [WED_1530] });

    const names = async (cookie: string) =>
      (await boardEntries(cookie, "open-posts")).map((el) => text(el.querySelector("h3")));

    const idleList = await names(idle);
    expect(idleList.indexOf(secondName)).toBeGreaterThanOrEqual(0);
    expect(idleList.indexOf(secondName)).toBeLessThan(idleList.indexOf(firstName));

    // your own post is pinned and not repeated in the list
    const pinned = await boardEntries(first, "your-post");
    expect(pinned.map((el) => text(el.querySelector("h3")))).toEqual([firstName]);
    const firstList = await names(first);
    expect(firstList).not.toContain(firstName);
    expect(firstList).toContain(secondName);

    // no open post: a Post a swap link, and no pinned entry
    const doc = await page("/", idle);
    expect(await boardEntries(idle, "your-post")).toHaveLength(0);
    expect(doc.querySelector('#your-post ~ a[href="/posts/new/"]')?.textContent?.trim()).toBe("Post a swap");
    expect(doc.querySelector('a[href="/posts/new/"]')).toBeTruthy();
    const mine = await page("/", first);
    expect(mine.querySelector('a[href="/posts/new/"]')).toBeNull();
  });

  it("links each entry to its post page", async () => {
    const cookie = await newStudent();
    await submitPost(cookie, OK);
    const id = await ownPostId(cookie);
    const viewer = await newStudent("viewer");
    const links = (await page("/", viewer)).querySelectorAll(`.post a[href="/posts/${id}/"]`);
    expect(links).toHaveLength(1);
  });

  it("shows the notice once after creating a post, not again on reload", async () => {
    const session = await newStudent();
    const res = await submitPost(session, OK);
    // play the browser: keep the cookies the redirect sets, drop the ones it clears
    const jar = new Map<string, string>([["session", session.replace("session=", "")]]);
    const apply = (r: Response) => {
      for (const line of r.headers.getSetCookie()) {
        const [pair, ...attrs] = line.split(";").map((s) => s.trim());
        const [name, value] = [pair.slice(0, pair.indexOf("=")), pair.slice(pair.indexOf("=") + 1)];
        const gone = value === "" || attrs.some((a) => /^max-age=0$/i.test(a) || /^expires=.*1970/i.test(a));
        if (gone) jar.delete(name);
        else jar.set(name, value);
      }
    };
    const header = () => [...jar].map(([k, v]) => `${k}=${v}`).join("; ");
    apply(res);

    const load = async () => {
      const r = await fetch(new URL("/", baseUrl), { headers: { cookie: header() } });
      apply(r);
      return text(new JSDOM(await r.text()).window.document.querySelector('[role="status"]'));
    };
    expect(await load()).toBe("Your swap post is on the board");
    expect(await load()).toBe("");
  });

  it("puts the notice above the student's own post", async () => {
    const session = await newStudent();
    const res = await submitPost(session, OK);
    const flash = res.headers.getSetCookie().find((c) => c.startsWith("flash="))?.split(";")[0];
    expect(flash).toBeTruthy();
    const r = await fetch(new URL("/", baseUrl), { headers: { cookie: `${session}; ${flash}` } });
    const doc = new JSDOM(await r.text()).window.document;
    const status = doc.querySelector('[role="status"]');
    const pinned = doc.querySelector("#your-post");
    expect(status && pinned && status.compareDocumentPosition(pinned) & 4).toBeTruthy(); // pinned follows status
  });

  it("ignores a notice cookie it did not set", async () => {
    const session = await newStudent();
    const r = await fetch(new URL("/", baseUrl), { headers: { cookie: `${session}; flash=<b>hi</b>` } });
    const doc = new JSDOM(await r.text()).window.document;
    expect(doc.querySelector('[role="status"]')).toBeNull();
  });
});

describe("the post page", () => {
  it("shows the whole post", async () => {
    const cookie = await newStudent();
    const username = await usernameOf(cookie);
    await submitPost(cookie, { ...OK, message: "Whole message here." });
    const id = await ownPostId(cookie);
    const res = await fetch(new URL(`/posts/${id}/`, baseUrl), { headers: { cookie } });
    expect(res.status).toBe(200);
    const doc = new JSDOM(await res.text()).window.document;
    const body = text(doc.querySelector("main"));
    expect(body).toContain(username);
    expect(body).toContain(classLabel(CLASSES[0]));
    expect(body).toContain(classLabel(CLASSES[2]));
    expect(body).toContain(classLabel(CLASSES[3]));
    expect(body).toContain("Whole message here.");
    expect(text(doc.querySelector("main time"))).toMatch(/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun) \d{1,2} [A-Z][a-z]{2}, \d\d:\d\d$/);
  });

  it("is 404 for an id that never existed, and needs a login", async () => {
    const cookie = await newStudent();
    for (const id of ["99999999", "0", "abc"]) {
      const res = await fetch(new URL(`/posts/${id}/`, baseUrl), { headers: { cookie } });
      expect(res.status, id).toBe(404);
    }
    const out = await fetch(new URL("/posts/1/", baseUrl), { redirect: "manual" });
    expect(out.status).toBe(302);
    expect(out.headers.get("location")).toContain("/login/");
  });
});

describe("times", () => {
  it("renders one known instant as Canberra time", () => {
    expect(formatCanberra(new Date("2026-09-28T04:05:00Z"))).toBe("Mon 28 Sep, 14:05");
    // daylight saving began on Sunday 4 October
    expect(formatCanberra(new Date("2026-10-05T03:05:00Z"))).toBe("Mon 5 Oct, 14:05");
    expect(formatCanberra(new Date("2026-09-27T14:05:00Z"))).toBe("Mon 28 Sep, 00:05");
  });

  it("shows Canberra time on a page whatever timezone the server runs in", async () => {
    const dbPath = join(mkdtempSync(join(tmpdir(), "posts-tz-")), "test.db");
    const migrated = await spawnServer(dbPath);
    await migrated.stop();
    const db = new Database(dbPath);
    const student = db.prepare("select id from students where username = 'noah'").get() as { id: number };
    const posted = db
      .prepare("insert into swap_posts (student_id, leaving_class_id, posted_at) values (?, 'shitao', ?) returning id")
      .get(student.id, Date.parse("2026-09-28T04:05:00Z")) as { id: number };
    db.prepare("insert into swap_post_join_classes (post_id, class_id) values (?, 'bada')").run(posted.id);
    db.close();

    for (const TZ of ["Pacific/Honolulu", "Asia/Kolkata", "UTC"]) {
      const server = await spawnServer(dbPath, { TZ });
      try {
        const cookie = await demoCookie("priya", server.baseUrl);
        const doc = await page(`/posts/${posted.id}/`, cookie, server.baseUrl);
        expect(text(doc.querySelector("main")), TZ).toContain("Mon 28 Sep, 14:05");
      } finally {
        await server.stop();
      }
    }
  }, 60_000);
});

describe("the classes seed file", () => {
  it("holds the six crit-group sessions with the date it was copied", () => {
    expect(CLASSES.map((c) => `${c.day} ${c.start}`)).toEqual([
      "Mon 14:00",
      "Mon 15:30",
      "Wed 09:00",
      "Wed 10:30",
      "Wed 14:00",
      "Wed 15:30",
    ]);
    expect(CLASSES_ACCESSED).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("is credited in the README: course, school, author, link, licence and date", () => {
    const readme = readFileSync("README.md", "utf8").replace(/\s+/g, " ");
    for (const part of [
      "COMP4020",
      "ANU School of Computing",
      "Ben Swift",
      "https://comp.anu.edu.au/courses/comp4020-agentic-coding-studio/",
      "CC BY-NC-SA 4.0",
      CLASSES_ACCESSED,
    ]) {
      expect(readme, part).toContain(part);
    }
  });
});

describe("the demo seed's posts", () => {
  it("opens a fresh database with alex's, priya's and lena's open posts (and jordan's swapped one), dated over the previous three days", async () => {
    const dbPath = join(mkdtempSync(join(tmpdir(), "posts-seed-")), "test.db");
    const before = Date.now();
    const server = await spawnServer(dbPath);
    try {
      const db = new Database(dbPath, { readonly: true });
      const posts = db
        .prepare(
          `select s.username, p.id, p.leaving_class_id as leaving, p.message, p.status, p.posted_at as at,
                  (select group_concat(class_id) from (select class_id from swap_post_join_classes where post_id = p.id order by class_id)) as joins
           from swap_posts p join students s on s.id = p.student_id order by s.username`,
        )
        .all() as { username: string; leaving: string; message: string | null; status: string; at: number; joins: string }[];
      db.close();

      expect(posts.map((p) => [p.username, p.leaving, p.joins, p.message, p.status])).toEqual([
        ["alex", MON_14, [WED_9, WED_1030].sort().join(","), "Clashes with my lab.", "open"],
        ["jordan", WED_14, WED_1530, null, "swapped"], // #21: off the board
        ["lena", MON_1530, [WED_14, WED_1530].sort().join(","), null, "open"],
        ["priya", WED_9, [MON_14, MON_1530].sort().join(","), null, "open"],
      ]);
      const ats = posts.map((p) => p.at);
      for (const at of ats) {
        expect(at).toBeLessThanOrEqual(Date.now());
        expect(at).toBeGreaterThan(before - 3 * 24 * 60 * 60 * 1000);
      }
      expect(new Set(ats).size).toBe(4);

      // and the board shows the three, newest first, to a student with no post
      const noah = await demoCookie("noah", server.baseUrl);
      const doc = await page("/", noah, server.baseUrl);
      const shown = [...doc.querySelectorAll("#open-posts ~ .post h3")].map((h) => text(h));
      expect(shown).toEqual(["lena", "priya", "alex"]);
      expect(text(doc.querySelector('#your-post ~ a[href="/posts/new/"]'))).toBe("Post a swap");
    } finally {
      await server.stop();
    }
  }, 60_000);

  it("shows the post part of each demo line on the login page, counts only", async () => {
    const dbPath = join(mkdtempSync(join(tmpdir(), "posts-lines-")), "test.db");
    const server = await spawnServer(dbPath);
    try {
      const lines = async () => {
        const doc = await page("/login/", undefined, server.baseUrl);
        return Object.fromEntries(
          [...doc.querySelectorAll(".demo-students li")]
            .map((li) => text(li.querySelector(".demo-line")))
            .filter(Boolean)
            .map((line) => line.split(": ")),
        );
      };
      expect(await lines()).toEqual({
        alex: "2 offers to answer · 1 unread message",
        priya: "1 offer to answer · 1 pending offer",
        sam: "1 pending offer",
        lena: "open post · 1 pending offer",
        jordan: "no post yet",
        mei: "no post yet",
        noah: "no post yet",
      });

      // it is live: noah posts and the line changes; nothing of the post leaks
      const noah = await demoCookie("noah", server.baseUrl);
      const res = await submitPost(noah, { ...OK, message: "secret-message-text" }, server.baseUrl);
      expect(res.status).toBe(303);
      expect((await lines()).noah).toBe("open post");
      const raw = await (await fetch(new URL("/login/", server.baseUrl))).text();
      expect(raw).not.toContain("secret-message-text");
    } finally {
      await server.stop();
    }
  }, 60_000);
});

