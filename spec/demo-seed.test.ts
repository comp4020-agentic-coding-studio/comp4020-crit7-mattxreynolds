import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";
import { JSDOM } from "jsdom";
import { describe, expect, inject, it } from "vitest";
import { hashPassword } from "../src/lib/password";
import { spawnServer } from "./spawn-server";

// The demo seed and one-click demo login (issue #17, decisions 0014, 0037,
// 0040). Observable through HTTP (log in as each demo student, read the
// login page) and, where a test controls its own database, by opening that
// SQLite file directly.
const baseUrl = inject("baseUrl");

const DEMO_USERNAMES = ["Alex", "Priya", "Sam", "Lena", "Jordan", "Mei", "Noah", "Zara"];
const DEMO_PASSWORD = "demo-student";

function postForm(origin: string, path: string, body: Record<string, string>) {
  return fetch(new URL(path, origin), {
    method: "POST",
    headers: { origin },
    body: new URLSearchParams(body),
    redirect: "manual",
  });
}

function sessionCookieFrom(res: Response): string | null {
  const match = res.headers.get("set-cookie")?.match(/session=([^;]+)/);
  return match ? `session=${match[1]}` : null;
}

async function loggedInAs(cookie: string, origin = baseUrl): Promise<string | null> {
  const res = await fetch(new URL("/", origin), { headers: { cookie } });
  const html = await res.text();
  return new JSDOM(html).window.document.querySelector(".nav-username")?.textContent?.trim() ?? null;
}

async function loginPage(path = "/login/"): Promise<Document> {
  const res = await fetch(new URL(path, baseUrl));
  return new JSDOM(await res.text()).window.document;
}

describe("the demo seed", () => {
  it("leaves a fresh database with exactly the eight demo students, each able to log in with demo-student", async () => {
    const dbPath = join(mkdtempSync(join(tmpdir(), "demo-seed-fresh-")), "test.db");
    const server = await spawnServer(dbPath);
    try {
      const db = new Database(dbPath, { readonly: true });
      const usernames = (db.prepare("select username from students order by id").all() as { username: string }[]).map(
        (row) => row.username,
      );
      db.close();
      expect(usernames.sort()).toEqual([...DEMO_USERNAMES].sort());

      for (const username of DEMO_USERNAMES) {
        const res = await postForm(server.baseUrl, "/api/login", { username, password: DEMO_PASSWORD, next: "/" });
        expect(res.status, username).toBe(303);
        expect(sessionCookieFrom(res), username).toBeTruthy();
      }
    } finally {
      await server.stop();
    }
  }, 30_000);

  it("gives Zara no post, offers, comments or private messages, and logs a demo name typed in lower case in", async () => {
    const dbPath = join(mkdtempSync(join(tmpdir(), "demo-seed-zara-")), "test.db");
    const server = await spawnServer(dbPath);
    try {
      const db = new Database(dbPath, { readonly: true });
      const zara = (db.prepare("select id from students where username = 'Zara'").get() as { id: number }).id;
      const count = (sql: string) => (db.prepare(sql).get({ zara }) as { n: number }).n;
      expect(count("select count(*) as n from swap_posts where student_id = @zara")).toBe(0);
      expect(count("select count(*) as n from offers where offerer_id = @zara")).toBe(0);
      expect(count("select count(*) as n from comments where author_id = @zara")).toBe(0);
      expect(count("select count(*) as n from private_messages where sender_id = @zara or recipient_id = @zara")).toBe(0);
      db.close();

      const res = await postForm(server.baseUrl, "/api/login", { username: "zara", password: DEMO_PASSWORD, next: "/" });
      expect(res.status).toBe(303);
      expect(await loggedInAs(sessionCookieFrom(res) ?? "", server.baseUrl)).toBe("Zara");
    } finally {
      await server.stop();
    }
  }, 30_000);

  it("is not rewritten when demo students already exist: what was changed survives a restart", async () => {
    const dbPath = join(mkdtempSync(join(tmpdir(), "demo-seed-restart-")), "test.db");
    const first = await spawnServer(dbPath);
    await first.stop();

    // No HTTP action changes a demo student yet, so make the changes
    // directly: alex's stored password, and mei removed altogether. A boot
    // that reseeded would put both back.
    const db = new Database(dbPath);
    db.prepare("update students set password_hash = 'changed:by-the-test' where username = 'Alex'").run();
    db.prepare("delete from students where username = 'Mei'").run();
    db.close();

    const second = await spawnServer(dbPath);
    await second.stop();

    const after = new Database(dbPath, { readonly: true });
    const alex = after.prepare("select password_hash from students where username = 'Alex'").get() as {
      password_hash: string;
    };
    const mei = after.prepare("select count(*) as n from students where username = 'Mei'").get() as { n: number };
    const total = after.prepare("select count(*) as n from students").get() as { n: number };
    after.close();
    expect(alex.password_hash).toBe("changed:by-the-test");
    expect(mei.n).toBe(0);
    expect(total.n).toBe(7);
  }, 60_000);
});

describe("a real student holding a demo name", () => {
  it("still boots when the name differs from a demo name only by case, and leaves that student alone", async () => {
    const dbPath = join(mkdtempSync(join(tmpdir(), "demo-seed-clash-")), "test.db");
    const first = await spawnServer(dbPath);
    await first.stop();
    const realHash = hashPassword("real-password-1");
    const db = new Database(dbPath);
    db.prepare("delete from students").run();
    db.prepare("insert into students (username, password_hash) values ('Alex', ?)").run(realHash);
    db.close();

    const second = await spawnServer(dbPath);
    try {
      const res = await postForm(second.baseUrl, "/login/demo", { username: "Alex", next: "/" });
      expect(sessionCookieFrom(res)).toBeNull();
    } finally {
      await second.stop();
    }
    const after = new Database(dbPath, { readonly: true });
    const alex = after.prepare("select username, password_hash from students where lower(username) = 'alex'").all();
    after.close();
    expect(alex).toEqual([{ username: "Alex", password_hash: realHash }]);
  }, 60_000);

  it("is never logged into by the one-click button without its password", async () => {
    const dbPath = join(mkdtempSync(join(tmpdir(), "demo-seed-real-")), "test.db");
    const first = await spawnServer(dbPath);
    await first.stop();
    const db = new Database(dbPath);
    db.prepare("update students set password_hash = ? where username = 'Priya'").run(hashPassword("real-password-1"));
    db.close();

    const second = await spawnServer(dbPath);
    try {
      const res = await postForm(second.baseUrl, "/login/demo", { username: "Priya", next: "/" });
      expect(sessionCookieFrom(res)).toBeNull();
      expect(res.headers.get("location")).toContain("/login/");
    } finally {
      await second.stop();
    }
  }, 60_000);
});

describe("the demo buttons on the login page", () => {
  it("shows eight named one-click buttons and Random demo student, on /login/ and on logged-out /", async () => {
    for (const path of ["/login/", "/"]) {
      const doc = await loginPage(path);
      const labels = [...doc.querySelectorAll('form[action="/login/demo"] button')].map((b) =>
        b.textContent?.trim(),
      );
      expect(labels, path).toEqual([...DEMO_USERNAMES, "Random demo student"]);
    }
  });

  it("logs in as each named student with no typing", async () => {
    for (const username of DEMO_USERNAMES) {
      const res = await postForm(baseUrl, "/login/demo", { username, next: "/" });
      expect(res.status, username).toBe(303);
      expect(res.headers.get("location"), username).toBe("/");
      const cookie = sessionCookieFrom(res);
      expect(cookie, username).toBeTruthy();
      expect(await loggedInAs(cookie ?? ""), username).toBe(username);
    }
  });

  it("logs in as one of the eight from Random demo student", async () => {
    const doc = await loginPage();
    const randomForm = [...doc.querySelectorAll('form[action="/login/demo"]')].find(
      (f) => f.querySelector("button")?.textContent?.trim() === "Random demo student",
    );
    const username = (randomForm?.querySelector('input[name="username"]') as HTMLInputElement | null)?.value;
    expect(username).toBeTruthy();

    for (let i = 0; i < 6; i++) {
      const res = await postForm(baseUrl, "/login/demo", { username: username ?? "", next: "/" });
      expect(res.status).toBe(303);
      expect(DEMO_USERNAMES).toContain(await loggedInAs(sessionCookieFrom(res) ?? ""));
    }
  });

  it("lands on the page first asked for, like the password form", async () => {
    const res = await postForm(baseUrl, "/login/demo", { username: "Priya", next: "/some-protected-page" });
    expect(res.headers.get("location")).toBe("/some-protected-page");

    const evil = await postForm(baseUrl, "/login/demo", { username: "Priya", next: "https://evil.example.com" });
    expect(evil.headers.get("location")).toBe("/");

    const carried = await loginPage("/login/?next=%2Fsome-protected-page");
    const next = [...carried.querySelectorAll('form[action="/login/demo"] input[name="next"]')].map(
      (i) => (i as HTMLInputElement).value,
    );
    expect(next).toEqual(Array(9).fill("/some-protected-page"));
  });

  it("does not log anyone in as a student who isn't a demo student, or with a made-up name", async () => {
    const username = `notdemo${(process.hrtime.bigint() % 1_000_000n).toString()}`;
    await postForm(baseUrl, "/api/signup", { username, password: "not-a-demo-pw1", next: "/" });

    for (const target of [username, "nobody-at-all", "ALEX "]) {
      const res = await postForm(baseUrl, "/login/demo", { username: target, next: "/" });
      expect(sessionCookieFrom(res), target).toBeNull();
      expect(res.headers.get("location"), target).toContain("/login/");
    }
  });
});

describe("demo names are taken", () => {
  it("fails signing up as Alex as a duplicate", async () => {
    const res = await postForm(baseUrl, "/api/signup", { username: "Alex", password: "longenough1", next: "/" });
    expect(sessionCookieFrom(res)).toBeNull();
    expect(res.headers.get("location")).toContain("/signup/");
    const error = new URL(res.headers.get("location") ?? "", baseUrl).searchParams.get("error");
    expect(error).toContain("taken");
  });
});

describe("demo names are reserved", () => {
  it("refuses every demo name as taken, in any case, even when its row is missing", async () => {
    const dbPath = join(mkdtempSync(join(tmpdir(), "demo-seed-reserved-")), "test.db");
    const first = await spawnServer(dbPath);
    await first.stop();
    const db = new Database(dbPath);
    // a partial seed is left alone on boot (0040), so mei and noah are free
    // rows-wise; the rule, not the seed, has to keep the names taken
    db.prepare("delete from students where username in ('Mei', 'Noah')").run();
    db.close();

    const second = await spawnServer(dbPath);
    try {
      for (const name of DEMO_USERNAMES) {
        for (const attempt of [name, name.toUpperCase()]) {
          const res = await postForm(second.baseUrl, "/api/signup", {
            username: attempt,
            password: "longenough1",
            next: "/",
          });
          expect(sessionCookieFrom(res), attempt).toBeNull();
          const error = new URL(res.headers.get("location") ?? "", second.baseUrl).searchParams.get("error");
          expect(error, attempt).toBe("That username is taken.");
        }
      }
    } finally {
      await second.stop();
    }
  }, 60_000);
});

describe("the README", () => {
  it("publishes the demo password", () => {
    expect(readFileSync("README.md", "utf8")).toMatch(new RegExp(`password\\s+\`${DEMO_PASSWORD}\``));
  });
});
