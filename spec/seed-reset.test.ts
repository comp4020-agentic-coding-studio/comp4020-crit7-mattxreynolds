import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, readdirSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { describe, expect, it } from "vitest";
import { seedClasses, seedDemoStudents, resetDemo, DEMO_USERNAMES } from "../src/lib/seed";
import { hashPassword } from "../src/lib/password";
import { demoCookie, page, text } from "./helpers";
import { spawnServer } from "./spawn-server";

// The seed reset (issue #26, decisions 0038, 0040, 0041, 0049). The rule is
// about rows, not pages, so most of this runs resetDemo against a temp SQLite
// file with the migrations applied; the built script and the absence of any
// route that resets are checked at the edges.

function openDb() {
  const path = join(mkdtempSync(join(tmpdir(), "seed-reset-")), "test.db");
  const raw = new Database(path);
  raw.pragma("journal_mode = WAL");
  const db = drizzle(raw);
  migrate(db, { migrationsFolder: "./drizzle" });
  seedClasses(db);
  seedDemoStudents(db);
  return { path, raw, db };
}

const isDemo = (name: string) => (DEMO_USERNAMES as readonly string[]).includes(name);

type Raw = InstanceType<typeof Database>;
const all = <T>(raw: Raw, sql: string): T[] => raw.prepare(sql).all() as T[];
const idOf = (raw: Raw, username: string): number =>
  (raw.prepare("select id from students where username = ?").get(username) as { id: number }).id;

// Everything the seed writes, described without ids or times: who, what and
// with whom, for every row that involves a demo student.
function demoState(raw: Raw) {
  const demo = `(${DEMO_USERNAMES.map((u) => `'${u}'`).join(",")})`;
  return {
    students: all<{ username: string }>(raw, `select username from students where username in ${demo} order by username`),
    posts: all(
      raw,
      `select s.username, p.leaving_class_id as leaving, p.status, p.message,
              (select group_concat(class_id) from (select class_id from swap_post_join_classes where post_id = p.id order by class_id)) as joins
         from swap_posts p join students s on s.id = p.student_id
        where s.username in ${demo} order by s.username, p.status`,
    ),
    offers: all(
      raw,
      `select o.status, o.offered_class_id as offered, r.username as offerer, s.username as poster, o.closed_reason as reason
         from offers o join students r on r.id = o.offerer_id join swap_posts p on p.id = o.post_id join students s on s.id = p.student_id
        where r.username in ${demo} or s.username in ${demo} order by r.username, s.username`,
    ),
    comments: all(
      raw,
      `select a.username as author, s.username as poster, c.body, c.deleted_at as deleted
         from comments c join students a on a.id = c.author_id join swap_posts p on p.id = c.post_id join students s on s.id = p.student_id
        where a.username in ${demo} or s.username in ${demo} order by c.body`,
    ),
    messages: all(
      raw,
      `select f.username as sender, t.username as recipient, m.body, m.read_at is not null as read
         from private_messages m join students f on f.id = m.sender_id join students t on t.id = m.recipient_id
        where f.username in ${demo} or t.username in ${demo} order by m.body`,
    ),
  };
}

// every row of every table, for "the database as it was"
function everything(raw: Raw) {
  const tables = all<{ name: string }>(raw, "select name from sqlite_master where type = 'table' and name not like '\\_\\_%' escape '\\' and name not like 'sqlite_%' order by name");
  return Object.fromEntries(tables.map((t) => [t.name, all(raw, `select * from ${t.name} order by rowid`)]));
}

const HOUR = 60 * 60 * 1000;
function realStudent(raw: Raw, username: string): number {
  return (
    raw
      .prepare("insert into students (username, password_hash) values (?, ?) returning id")
      .get(username, hashPassword("real-password-1")) as { id: number }
  ).id;
}
function post(raw: Raw, studentId: number, leaving: string, join: string[], status = "open"): number {
  const { id } = raw
    .prepare("insert into swap_posts (student_id, leaving_class_id, status, posted_at) values (?, ?, ?, ?) returning id")
    .get(studentId, leaving, status, Date.now() - HOUR) as { id: number };
  for (const c of join) raw.prepare("insert into swap_post_join_classes (post_id, class_id) values (?, ?)").run(id, c);
  return id;
}
function offer(raw: Raw, postId: number, offererId: number, offered: string, status = "pending"): number {
  return (
    raw
      .prepare("insert into offers (post_id, offerer_id, offered_class_id, status, created_at) values (?, ?, ?, ?, ?) returning id")
      .get(postId, offererId, offered, status, Date.now() - HOUR) as { id: number }
  ).id;
}
function comment(raw: Raw, postId: number, authorId: number, body: string): void {
  raw.prepare("insert into comments (post_id, author_id, body, created_at) values (?, ?, ?, ?)").run(postId, authorId, body, Date.now());
}
function message(raw: Raw, from: number, to: number, body: string): void {
  raw.prepare("insert into private_messages (sender_id, recipient_id, body, created_at) values (?, ?, ?, ?)").run(from, to, body, Date.now());
}

const [MON_14, MON_1530, WED_9, WED_1030, WED_14, WED_1530] = (
  all<{ id: string }>(openDb().raw, "select id from classes order by position")
).map((c) => c.id);

// A database the way it is after a crit's worth of use: demo rows used up and
// added to, and real students with rows of their own, some involving a demo
// student and some not.
function mess(raw: Raw) {
  const [alex, priya, noah, mei] = ["alex", "priya", "noah", "mei"].map((u) => idOf(raw, u));
  const ria = realStudent(raw, "ria");
  const bo = realStudent(raw, "bo");
  const cy = realStudent(raw, "cy");
  const dee = realStudent(raw, "dee");

  // real-only rows: a post with an offer, a comment thread, a conversation,
  // and a post swapped through another real student's accepted offer
  const riaPost = post(raw, ria, WED_9, [MON_14]);
  const boOnRia = offer(raw, riaPost, bo, MON_14);
  comment(raw, riaPost, bo, "real comment on a real post");
  message(raw, ria, bo, "real private message");
  const cyPost = post(raw, cy, WED_14, [WED_1530], "swapped");
  const deeOnCy = offer(raw, cyPost, dee, WED_1530, "accepted");
  // noah's offer on that swap was closed when it was accepted (0024): it goes,
  // the swap does not, because only an accepted demo offer takes a post along
  const closedDemoOffer = offer(raw, cyPost, noah, WED_1530, "closed");
  raw.prepare("update offers set closed_reason = 'post-swapped' where id = ?").run(closedDemoOffer);

  // rows that involve a demo student and so go: noah's offer and comment on
  // ria's post, a message to ria, ria's offer and comment on alex's post, a
  // real student's post swapped through mei's accepted offer
  offer(raw, riaPost, noah, WED_1030);
  comment(raw, riaPost, noah, "noah on a real post");
  message(raw, noah, ria, "noah to a real student");
  message(raw, ria, priya, "a real student to priya");
  const alexPost = (raw.prepare("select id from swap_posts where student_id = ? and status = 'open'").get(alex) as { id: number }).id;
  offer(raw, alexPost, ria, WED_1030);
  comment(raw, alexPost, ria, "ria on alex's post");
  const boPost = post(raw, bo, MON_1530, [WED_14], "swapped");
  offer(raw, boPost, mei, WED_14, "accepted");
  comment(raw, boPost, bo, "bo on the post swapped with mei");

  // demo changes: alex's post withdrawn, its offers closed, a message gone,
  // noah with a post of his own
  raw.prepare("update swap_posts set status = 'withdrawn' where id = ?").run(alexPost);
  raw.prepare("update offers set status = 'closed', closed_reason = 'post-withdrawn' where post_id = ?").run(alexPost);
  raw.prepare("delete from private_messages where body like 'Hi Alex%'").run();
  post(raw, noah, WED_1030, [MON_14]);
  return { riaPost, boOnRia, cyPost, deeOnCy, boPost, closedDemoOffer };
}

// the rows that involve only real students, as they stand: the two real posts
// that stay, the offer on and comment on the first by real students, the
// real swap's accepted offer and the real conversation
function realOnly(raw: Raw, ids: ReturnType<typeof mess>) {
  return {
    posts: all(raw, `select * from swap_posts where id in (${ids.riaPost}, ${ids.cyPost}) order by id`),
    joins: all(raw, `select * from swap_post_join_classes where post_id in (${ids.riaPost}, ${ids.cyPost}) order by post_id, class_id`),
    offers: all(raw, `select * from offers where id in (${ids.boOnRia}, ${ids.deeOnCy}) order by id`),
    comments: all(raw, "select * from comments where body = 'real comment on a real post'"),
    messages: all(raw, "select * from private_messages where body = 'real private message'"),
    students: all(raw, "select * from students where username in ('ria', 'bo', 'cy', 'dee') order by id"),
  };
}

describe("resetDemo", () => {
  it("puts the demo back to the seed and leaves rows involving only real students exactly as they were", () => {
    const fresh = demoState(openDb().raw);
    const { raw, db } = openDb();
    const ids = mess(raw);
    expect(demoState(raw)).not.toEqual(fresh);
    const real = realOnly(raw, ids);
    expect(real.posts).toHaveLength(2);
    expect(real.joins).toHaveLength(2);
    expect(real.offers).toHaveLength(2);
    expect(real.comments).toHaveLength(1);
    expect(real.messages).toHaveLength(1);
    expect(real.students).toHaveLength(4);
    const studentsBefore = all<{ id: number; username: string; password_hash: string }>(raw, "select id, username, password_hash from students order by id");

    resetDemo(db);

    expect(demoState(raw)).toEqual(fresh);
    expect(realOnly(raw, ids)).toEqual(real);
    // every student, demo and real, is still there with the same account
    expect(all(raw, "select id, username, password_hash from students order by id")).toEqual(studentsBefore);

    // the real student's post swapped through mei's accepted offer went with
    // it, and the real post swapped between two real students stayed
    expect(raw.prepare("select count(*) as n from swap_posts where id = ?").get(ids.boPost)).toEqual({ n: 0 });
    expect(raw.prepare("select count(*) as n from comments where post_id = ?").get(ids.boPost)).toEqual({ n: 0 });
    expect(raw.prepare("select count(*) as n from swap_posts where id = ?").get(ids.cyPost)).toEqual({ n: 1 });
    expect(raw.prepare("select count(*) as n from offers where id = ?").get(ids.deeOnCy)).toEqual({ n: 1 });
    expect(raw.prepare("select count(*) as n from offers where id = ?").get(ids.closedDemoOffer)).toEqual({ n: 0 });
    // a real student's own post stays without the demo offer and comment on it
    expect(raw.prepare("select count(*) as n from swap_posts where id = ?").get(ids.riaPost)).toEqual({ n: 1 });
    expect(raw.prepare("select count(*) as n from offers where post_id = ?").get(ids.riaPost)).toEqual({ n: 1 });
    expect(raw.prepare("select count(*) as n from comments where post_id = ?").get(ids.riaPost)).toEqual({ n: 1 });
    // no orphans from the deletes
    expect(all(raw, "pragma foreign_key_check")).toEqual([]);
  });

  it("writes the seed's times again, relative to the reset", () => {
    const { raw, db } = openDb();
    raw.prepare("update swap_posts set posted_at = 0").run();
    const before = Date.now();
    resetDemo(db);
    const posted = all<{ posted_at: number }>(raw, "select posted_at from swap_posts").map((p) => p.posted_at);
    expect(Math.min(...posted)).toBeGreaterThan(before - 72 * HOUR);
    expect(Math.max(...posted)).toBeLessThanOrEqual(Date.now());
  });

  it("brings back a missing demo student and leaves a real student who differs from a demo name only by case alone", () => {
    const { raw, db } = openDb();
    raw.prepare("delete from students where username = 'noah'").run();
    raw.prepare("delete from students where username = 'alex'").run();
    const realHash = hashPassword("real-password-2");
    raw.prepare("insert into students (username, password_hash) values ('Alex', ?)").run(realHash);
    resetDemo(db);
    expect(all(raw, "select username from students order by username")).toEqual(
      ["Alex", "jordan", "lena", "mei", "noah", "priya", "sam"].map((username) => ({ username })),
    );
    expect(raw.prepare("select password_hash from students where username = 'Alex'").get()).toEqual({ password_hash: realHash });
    // the real Alex has none of the seed's alex rows
    expect(raw.prepare("select count(*) as n from swap_posts where student_id = ?").get(idOf(raw, "Alex"))).toEqual({ n: 0 });
  });

  it("is idempotent", () => {
    const { raw, db } = openDb();
    resetDemo(db);
    const once = demoState(raw);
    resetDemo(db);
    expect(demoState(raw)).toEqual(once);
    expect(isDemo("alex")).toBe(true);
  });

  it("runs in one transaction: a failure part-way leaves the database as it was", () => {
    const { raw, db } = openDb();
    mess(raw);
    const before = everything(raw);

    // the reset deletes first and writes the seed second: break the last of
    // the writes, after everything has been deleted
    raw.exec(
      "create trigger fail_seed_message before insert on private_messages begin select raise(abort, 'broken on purpose'); end",
    );
    expect(() => resetDemo(db)).toThrow(/broken on purpose/);
    expect(everything(raw)).toEqual(before);

    // and the same for a failure while deleting
    raw.exec("drop trigger fail_seed_message");
    raw.exec(
      "create trigger fail_delete_offer before delete on offers begin select raise(abort, 'broken deleting'); end",
    );
    expect(() => resetDemo(db)).toThrow(/broken deleting/);
    expect(everything(raw)).toEqual(before);
  });
});

describe("the board after a reset", () => {
  it("opens with 3 open posts, pending-offer counts 2, 1, 0 and comment counts 2, 0, 0", async () => {
    const { path, raw, db } = openDb();
    // use the demo up: everything decided, withdrawn or deleted
    raw.prepare("update swap_posts set status = 'withdrawn'").run();
    raw.prepare("update offers set status = 'declined'").run();
    raw.prepare("update comments set deleted_at = 1").run();
    raw.prepare("delete from students where username = 'noah'").run();
    resetDemo(db);
    raw.close();

    const server = await spawnServer(path);
    try {
      const noah = await demoCookie("noah", server.baseUrl);
      const doc = await page("/", noah, server.baseUrl);
      const entries = [...doc.querySelectorAll("#open-posts ~ .board-post")].map((el) => ({
        poster: text(el.querySelector("h3")),
        offers: text(el.querySelector(".offer-count")),
        comments: text(el.querySelector(".comment-count")),
      }));
      expect(entries.length).toBe(3);
      const by = Object.fromEntries(entries.map((e) => [e.poster, e]));
      expect(by.alex).toMatchObject({ offers: "2 pending offers", comments: "2 comments" });
      expect(by.priya).toMatchObject({ offers: "1 pending offer", comments: "0 comments" });
      expect(by.lena).toMatchObject({ offers: "0 pending offers", comments: "0 comments" });
    } finally {
      await server.stop();
    }
  }, 60_000);
});

describe("the reset script", () => {
  it("is built into dist beside the server, and pnpm seed:reset runs that same file", () => {
    expect(existsSync("dist/seed-reset.mjs")).toBe(true);
    expect(existsSync("dist/server/entry.mjs")).toBe(true);
    const scripts = JSON.parse(readFileSync("package.json", "utf8")).scripts as Record<string, string>;
    expect(scripts.build).toContain("seed-reset");
    expect(scripts["seed:reset"]).toContain("dist/seed-reset.mjs");
  });

  it("runs as `node dist/seed-reset.mjs` against DATABASE_PATH and restores the demo", () => {
    const path = join(mkdtempSync(join(tmpdir(), "seed-reset-script-")), "script.db");
    const run = () =>
      execFileSync("node", ["dist/seed-reset.mjs"], { env: { ...process.env, DATABASE_PATH: path }, encoding: "utf8" });

    // the first run on an empty path migrates and seeds it
    run();
    const raw = new Database(path);
    const fresh = demoState(raw);
    raw.prepare("update swap_posts set status = 'withdrawn'").run();
    raw.prepare("delete from private_messages").run();
    realStudent(raw, "ria");
    expect(demoState(raw)).not.toEqual(fresh);
    raw.close();

    const output = run();
    expect(output).toContain(path);
    const after = new Database(path, { readonly: true });
    expect(demoState(after)).toEqual(fresh);
    expect(all(after, "select username from students where username = 'ria'")).toHaveLength(1);
    after.close();
  }, 30_000);
});

// The app has no reset button (0040): nothing in the served app calls the
// reset or answers a request for one.
describe("no route or page resets anything", () => {
  const sources = (dir: string): string[] =>
    readdirSync(dir).flatMap((name) => {
      const p = join(dir, name);
      return statSync(p).isDirectory() ? sources(p) : [p];
    });

  it("is not referenced from anything the server serves", () => {
    const served = ["src/pages", "src/components", "src/layouts", "src/scripts", "src/middleware.ts"].flatMap((p) =>
      statSync(p).isDirectory() ? sources(p) : [p],
    );
    const offenders = served.filter((file) => /resetDemo|seed-reset/.test(readFileSync(file, "utf8")));
    expect(offenders).toEqual([]);
    // and only the script imports it from the library
    const importers = sources("src")
      .filter((file) => /resetDemo/.test(readFileSync(file, "utf8")))
      .sort();
    expect(importers).toEqual(["src/lib/seed.ts", "src/seed-reset.ts"]);
  });

  it("answers no request for one, GET or POST, and the demo is unchanged", async () => {
    // a server of its own, so no other spec file is writing to the board
    const server = await spawnServer(join(mkdtempSync(join(tmpdir(), "seed-reset-routes-")), "routes.db"));
    try {
      const cookie = await demoCookie("alex", server.baseUrl);
      const before = boardText(await page("/", cookie, server.baseUrl));
      expect(before.length).toBe(3);
      for (const path of ["/reset/", "/seed/", "/seed/reset/", "/seed-reset/", "/api/reset", "/api/seed-reset", "/api/seed/reset", "/admin/reset/", "/api/demo/reset"]) {
        for (const method of ["GET", "POST"]) {
          const res = await fetch(new URL(path, server.baseUrl), {
            method,
            headers: { origin: server.baseUrl, cookie },
            redirect: "manual",
          });
          expect(res.status, `${method} ${path}`).toBe(404);
        }
      }
      expect(boardText(await page("/", cookie, server.baseUrl))).toEqual(before);
    } finally {
      await server.stop();
    }
  }, 60_000);

  it("shows no reset control on the board or the login page", async () => {
    const cookie = await demoCookie("alex");
    for (const doc of [await page("/", cookie), await page("/login/")]) {
      const controls = [...doc.querySelectorAll("button, input[type=submit], a")].map((el) => text(el) || el.getAttribute("value") || "");
      expect(controls.filter((label) => /reset/i.test(label))).toEqual([]);
    }
  });
});

function boardText(doc: Document): string[] {
  return [...doc.querySelectorAll(".board-post")].map((el) => text(el));
}
