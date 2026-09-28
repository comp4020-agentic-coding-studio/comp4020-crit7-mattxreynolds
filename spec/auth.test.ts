import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { JSDOM } from "jsdom";
import { describe, expect, inject, it } from "vitest";
import { DEMO_LOGIN_NOTICE } from "../src/lib/notice";
import { spawnServer } from "./spawn-server";

// Sign up, log in, log out, and the login gate (issue #16). Every rule here
// is enforced server-side and observable as status, redirect target, cookie
// and HTML, so these tests survive a change of UI.
const baseUrl = inject("baseUrl");

function uniqueUsername(prefix: string): string {
  const suffix = (process.hrtime.bigint() % 10_000_000n).toString();
  return `${prefix}${suffix}`;
}

// Astro checks form POSTs carry a same-origin Origin header (CSRF
// protection); browsers send it automatically, a bare fetch doesn't.
function postForm(path: string, body: Record<string, string>, cookie?: string) {
  const headers: Record<string, string> = { origin: baseUrl };
  if (cookie) headers.cookie = cookie;
  return fetch(new URL(path, baseUrl), {
    method: "POST",
    headers,
    body: new URLSearchParams(body),
    redirect: "manual",
  });
}

function sessionCookieFrom(res: Response): string | null {
  const setCookie = res.headers.get("set-cookie");
  const match = setCookie?.match(/session=([^;]+)/);
  return match ? `session=${match[1]}` : null;
}

function errorFrom(res: Response): string | null {
  return new URL(res.headers.get("location") ?? "", baseUrl).searchParams.get("error");
}

async function signUpAndGetCookie(username: string, password: string): Promise<string> {
  const res = await postForm("/api/signup", { username, password, next: "/" });
  const cookie = sessionCookieFrom(res);
  if (!cookie) throw new Error("sign-up did not set a session cookie");
  return cookie;
}

describe("sign-up", () => {
  it("accepts a valid username and password, and logs the student in", async () => {
    const username = uniqueUsername("valid");
    const res = await postForm("/api/signup", { username, password: "longenough1", next: "/" });
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("/");
    expect(sessionCookieFrom(res)).toBeTruthy();
  });

  it("rejects a username shorter than 3 characters, with a message", async () => {
    const res = await postForm("/api/signup", { username: "ab", password: "longenough1", next: "/" });
    expect(res.headers.get("location")).toContain("/signup/");
    expect(errorFrom(res)).toContain("3-20");
  });

  it("rejects a username with characters outside letters, digits, - and _, with a message", async () => {
    const res = await postForm("/api/signup", { username: "bad username!", password: "longenough1", next: "/" });
    expect(res.headers.get("location")).toContain("/signup/");
    expect(errorFrom(res)).toContain("3-20");
  });

  it("rejects a password under 8 characters, with a message", async () => {
    const res = await postForm("/api/signup", {
      username: uniqueUsername("shortpw"),
      password: "short1",
      next: "/",
    });
    expect(res.headers.get("location")).toContain("/signup/");
    expect(errorFrom(res)).toContain("at least 8 characters");
  });

  it("refuses a duplicate username differing only in case, with a message", async () => {
    const username = uniqueUsername("dupe");
    const first = await postForm("/api/signup", { username, password: "longenough1", next: "/" });
    expect(first.status).toBe(303);
    expect(first.headers.get("location")).toBe("/");

    const second = await postForm("/api/signup", {
      username: username.toUpperCase(),
      password: "longenough2",
      next: "/",
    });
    expect(second.headers.get("location")).toContain("/signup/");
    expect(errorFrom(second)).toContain("taken");
  });
});

describe("log in", () => {
  it("sets a session cookie lasting about 30 days on the right password", async () => {
    const username = uniqueUsername("login");
    const password = "correct-password1";
    await postForm("/api/signup", { username, password, next: "/" });

    const res = await postForm("/api/login", { username, password, next: "/" });
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("/");

    const setCookie = res.headers.get("set-cookie") ?? "";
    const maxAge = Number(setCookie.match(/max-age=(\d+)/i)?.[1]);
    const thirtyDays = 30 * 24 * 60 * 60;
    expect(maxAge).toBeGreaterThan(thirtyDays - 60);
    expect(maxAge).toBeLessThanOrEqual(thirtyDays);
  });

  it("refuses a wrong password, and a wrong username, with the same message", async () => {
    const username = uniqueUsername("wrongpw");
    await postForm("/api/signup", { username, password: "correct-password1", next: "/" });

    const wrongPassword = await postForm("/api/login", { username, password: "not-the-password", next: "/" });
    const wrongUsername = await postForm("/api/login", {
      username: uniqueUsername("nouser"),
      password: "correct-password1",
      next: "/",
    });

    expect(errorFrom(wrongPassword)).toBe("Incorrect username or password.");
    expect(errorFrom(wrongUsername)).toBe(errorFrom(wrongPassword));
    expect(sessionCookieFrom(wrongPassword)).toBeNull();
  });
});

describe("sessions are rows in the database", () => {
  it("a session still works after the server restarts on the same database", async () => {
    const dbPath = join(mkdtempSync(join(tmpdir(), "auth-restart-")), "test.db");
    const first = await spawnServer(dbPath);
    const username = uniqueUsername("restart");
    const signupRes = await fetch(new URL("/api/signup", first.baseUrl), {
      method: "POST",
      headers: { origin: first.baseUrl },
      body: new URLSearchParams({ username, password: "restart-password1", next: "/" }),
      redirect: "manual",
    });
    const cookie = sessionCookieFrom(signupRes);
    first.stop();
    expect(cookie).toBeTruthy();

    const second = await spawnServer(dbPath);
    try {
      const res = await fetch(new URL("/", second.baseUrl), { headers: { cookie: cookie ?? "" } });
      expect(await res.text()).toContain(username);
    } finally {
      second.stop();
    }
  }, 30_000);
});

describe("log out", () => {
  it("is on every logged-in page and ends the session in the database", async () => {
    const username = uniqueUsername("logout");
    const cookie = await signUpAndGetCookie(username, "logout-password1");

    const board = await fetch(new URL("/", baseUrl), { headers: { cookie } });
    expect(await board.text()).toContain("Log out");
    const readme = await fetch(new URL("/readme/", baseUrl), { headers: { cookie } });
    expect(await readme.text()).toContain("Log out");

    const logoutRes = await postForm("/logout", {}, cookie);
    expect(logoutRes.status).toBeGreaterThanOrEqual(300);
    expect(logoutRes.status).toBeLessThan(400);

    const afterLogout = await fetch(new URL("/", baseUrl), { headers: { cookie } });
    const html = await afterLogout.text();
    expect(html).not.toContain("Log out");
    expect(html).toContain("Log in");
  });
});

describe("the login gate", () => {
  it("serves the login page at / logged out, with a 200, and logging in from it lands on the board", async () => {
    const res = await fetch(new URL("/", baseUrl));
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("Log in");

    const username = uniqueUsername("gate");
    const password = "gate-password1";
    await postForm("/api/signup", { username, password, next: "/" });
    const loginRes = await postForm("/api/login", { username, password, next: "/" });
    expect(loginRes.headers.get("location")).toBe("/");

    const cookie = sessionCookieFrom(loginRes) ?? "";
    const board = await fetch(new URL("/", baseUrl), { headers: { cookie } });
    expect(await board.text()).toContain("Board");
  });

  it("redirects a logged-out visit to any other protected page to /login/?next=…, and logging in from there returns them there", async () => {
    const res = await fetch(new URL("/some-protected-page", baseUrl), { redirect: "manual" });
    expect(res.status).toBeGreaterThanOrEqual(300);
    expect(res.status).toBeLessThan(400);
    expect(res.headers.get("location")).toBe("/login/?next=%2Fsome-protected-page");

    const username = uniqueUsername("nextpage");
    const password = "next-password1";
    await postForm("/api/signup", { username, password, next: "/" });
    const loginRes = await postForm("/api/login", { username, password, next: "/some-protected-page" });
    expect(loginRes.headers.get("location")).toBe("/some-protected-page");
  });

  it("lets /readme/, /login/ and /signup/ through logged out", async () => {
    for (const path of ["/readme/", "/login/", "/signup/"]) {
      const res = await fetch(new URL(path, baseUrl));
      expect(res.status, path).toBe(200);
    }
  });
});

describe("the next-page target", () => {
  it("only ever points inside the app: an off-site next is dropped, not followed", async () => {
    for (const evil of ["https://evil.example.com", "//evil.example.com"]) {
      const res = await fetch(new URL(`/login/?next=${encodeURIComponent(evil)}`, baseUrl));
      expect(await res.text()).toContain('value="/"');
    }

    const username = uniqueUsername("openredirect");
    const password = "redirect-password1";
    await postForm("/api/signup", { username, password, next: "/" });
    const res = await postForm("/api/login", { username, password, next: "https://evil.example.com" });
    expect(res.headers.get("location")).toBe("/");
  });
});

// Letters and digits only, so line-wrapping, markdown emphasis and rendered
// punctuation (curly apostrophes, HTML entities) don't break the comparison
// — the same approach spec/readme.test.ts uses for the same reason.
const normalize = (s: string): string => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");

describe("the demo-login notice (0015)", () => {
  it("appears on the sign-up form and in README.md, and the README rules out rate limiting, password reset and account deletion", async () => {
    const res = await fetch(new URL("/signup/", baseUrl));
    const text = new JSDOM(await res.text()).window.document.body.textContent ?? "";
    expect(normalize(text)).toContain(normalize(DEMO_LOGIN_NOTICE));

    const readme = readFileSync("README.md", "utf8");
    expect(normalize(readme)).toContain(normalize(DEMO_LOGIN_NOTICE));
    expect(normalize(readme)).toContain(normalize("no rate limiting, password reset or account deletion"));
  });
});
