import { randomBytes } from "node:crypto";
import type { AstroCookies } from "astro";
import { eq, sql } from "drizzle-orm";
import { db } from "./db";
import { hashPassword, verifyPassword } from "./password";
import { type Student, sessions, students } from "./schema";
import { DEMO_USERNAMES } from "./seed";

export const SESSION_COOKIE = "session";
export const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000;

const USERNAME_PATTERN = /^[A-Za-z0-9_-]{3,20}$/;

function findByUsername(username: string): Student | undefined {
  return db
    .select()
    .from(students)
    .where(sql`lower(${students.username}) = lower(${username})`)
    .get();
}

export type SignUpResult = { ok: true; student: Student } | { ok: false; error: string };

// The only validation the login slice enforces (0011): a shape for the
// username, a length floor for the password, and case-insensitive
// uniqueness. Nothing else about a student is stored.
export function signUp(username: string, password: string): SignUpResult {
  if (!USERNAME_PATTERN.test(username)) {
    return {
      ok: false,
      error: "Username must be 3-20 characters: letters, digits, - or _.",
    };
  }
  if (password.length < 8) {
    return { ok: false, error: "Password must be at least 8 characters." };
  }
  if (findByUsername(username)) {
    return { ok: false, error: "That username is taken." };
  }
  try {
    const student = db
      .insert(students)
      .values({ username, passwordHash: hashPassword(password) })
      .returning()
      .get();
    return { ok: true, student };
  } catch (error) {
    // a concurrent sign-up can win the race between the check above and this
    // insert; the unique index on lower(username) is the real guard.
    if (error instanceof Error && /UNIQUE constraint failed/.test(error.message)) {
      return { ok: false, error: "That username is taken." };
    }
    throw error;
  }
}

// A wrong username and a wrong password look identical to the caller, so
// neither leaks which part was wrong.
export function logIn(username: string, password: string): Student | null {
  const student = findByUsername(username);
  if (!student || !verifyPassword(password, student.passwordHash)) return null;
  return student;
}

// One-click demo login (0014): the demo password is published, so typing it
// proves nothing; the button names a demo student directly. Only an exact
// demo username (or "random") ever resolves, so this can't be used to log in
// as any other student.
export const RANDOM_DEMO = "random";

export function demoStudent(choice: string): Student | null {
  const username =
    choice === RANDOM_DEMO
      ? DEMO_USERNAMES[Math.floor(Math.random() * DEMO_USERNAMES.length)]
      : DEMO_USERNAMES.find((name) => name === choice);
  if (!username) return null;
  return db.select().from(students).where(eq(students.username, username)).get() ?? null;
}

export function createSession(studentId: number): { token: string; expiresAt: Date } {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);
  db.insert(sessions).values({ token, studentId, expiresAt: expiresAt.toISOString() }).run();
  return { token, expiresAt };
}

// Sessions are rows in the database (0012), so a lookup here is what makes a
// login survive a restart: nothing about it lives only in server memory.
export function getStudentForToken(token: string): Student | null {
  const row = db
    .select({ student: students, expiresAt: sessions.expiresAt })
    .from(sessions)
    .innerJoin(students, eq(sessions.studentId, students.id))
    .where(eq(sessions.token, token))
    .get();
  if (!row) return null;
  if (new Date(row.expiresAt).getTime() <= Date.now()) {
    db.delete(sessions).where(eq(sessions.token, token)).run();
    return null;
  }
  return row.student;
}

export function deleteSession(token: string): void {
  db.delete(sessions).where(eq(sessions.token, token)).run();
}

// Only a same-app path is ever a valid redirect target: no scheme, no
// authority, no whitespace or control characters. A backslash is refused
// outright, not just a leading "//" — the WHATWG URL parser treats a
// leading "/\" the same as "//" (special-scheme authority parsing treats "/"
// and "\" interchangeably), so "/\evil.example.com" would otherwise resolve
// to an off-site host despite passing a "//"-only check.
const SAFE_NEXT_PATH = /^\/(?!\/)[!-~]*$/;

export function safeNextPath(raw: string | null | undefined): string {
  if (!raw || raw.includes("\\") || !SAFE_NEXT_PATH.test(raw)) return "/";
  return raw;
}

// Fly terminates TLS at its edge and forwards to the app over plain HTTP
// (fly.toml: force_https, internal_port) — the Node adapter's own protocol
// detection (req.socket.encrypted, which is what Astro.url.protocol relies
// on) is therefore always "http:" in production. The client's real scheme
// comes from the header Fly sets instead.
export function isSecureRequest(request: Request): boolean {
  return request.headers.get("x-forwarded-proto") === "https" || new URL(request.url).protocol === "https:";
}

export function startSession(cookies: AstroCookies, request: Request, studentId: number): void {
  const { token } = createSession(studentId);
  cookies.set(SESSION_COOKIE, token, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: isSecureRequest(request),
    maxAge: SESSION_DURATION_MS / 1000,
  });
}
