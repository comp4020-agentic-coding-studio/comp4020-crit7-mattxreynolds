import { JSDOM } from "jsdom";
import { inject } from "vitest";

// Shared by the swap post specs: a student with a session, form posts that
// carry the same-origin header Astro's CSRF check wants (a bare fetch sends
// none), and a page parsed for querying.
export const baseUrl = inject("baseUrl");

export function uniqueUsername(prefix: string): string {
  return `${prefix}${(process.hrtime.bigint() % 10_000_000n).toString()}`;
}

export function sessionCookieFrom(res: Response): string | null {
  const match = res.headers.get("set-cookie")?.match(/session=([^;]+)/);
  return match ? `session=${match[1]}` : null;
}

export async function newStudent(prefix = "poster", origin = baseUrl): Promise<string> {
  const res = await fetch(new URL("/api/signup", origin), {
    method: "POST",
    headers: { origin },
    body: new URLSearchParams({ username: uniqueUsername(prefix), password: "spec-password-1", next: "/" }),
    redirect: "manual",
  });
  const cookie = sessionCookieFrom(res);
  if (!cookie) throw new Error("sign-up did not set a session cookie");
  return cookie;
}

export async function usernameOf(cookie: string, origin = baseUrl): Promise<string> {
  const doc = await page("/", cookie, origin);
  return doc.querySelector("main strong")?.textContent ?? "";
}

export async function demoCookie(username: string, origin = baseUrl): Promise<string> {
  const res = await fetch(new URL("/login/demo", origin), {
    method: "POST",
    headers: { origin },
    body: new URLSearchParams({ username, next: "/" }),
    redirect: "manual",
  });
  const cookie = sessionCookieFrom(res);
  if (!cookie) throw new Error(`demo login as ${username} failed`);
  return cookie;
}

export interface PostFields {
  leaving?: string;
  join?: string[];
  message?: string;
}

/** Submit the new-post form as the student with this cookie. */
export function submitPost(cookie: string, fields: PostFields, origin = baseUrl): Promise<Response> {
  const body = new URLSearchParams();
  if (fields.leaving !== undefined) body.set("leaving", fields.leaving);
  for (const id of fields.join ?? []) body.append("join", id);
  if (fields.message !== undefined) body.set("message", fields.message);
  return fetch(new URL("/posts/new/", origin), {
    method: "POST",
    headers: { origin, cookie },
    body,
    redirect: "manual",
  });
}

export async function page(path: string, cookie?: string, origin = baseUrl): Promise<Document> {
  const res = await fetch(new URL(path, origin), { headers: cookie ? { cookie } : {} });
  return new JSDOM(await res.text()).window.document;
}

export const text = (el: Element | null | undefined): string => el?.textContent?.replace(/\s+/g, " ").trim() ?? "";

/** The id of the student's own open post, read from "Your post" on the board. */
export async function ownPostId(cookie: string, origin = baseUrl): Promise<number | null> {
  const doc = await page("/", cookie, origin);
  const href = doc.querySelector('#your-post ~ .post a[href^="/posts/"]')?.getAttribute("href");
  const id = href?.match(/^\/posts\/(\d+)\/$/)?.[1];
  return id ? Number(id) : null;
}

/** Submit the edit form of post `id` as the student with this cookie. */
export function submitEdit(cookie: string, id: number | string, fields: PostFields, origin = baseUrl): Promise<Response> {
  const body = new URLSearchParams();
  if (fields.leaving !== undefined) body.set("leaving", fields.leaving);
  for (const classId of fields.join ?? []) body.append("join", classId);
  if (fields.message !== undefined) body.set("message", fields.message);
  return fetch(new URL(`/posts/${id}/edit/`, origin), {
    method: "POST",
    headers: { origin, cookie },
    body,
    redirect: "manual",
  });
}

/** Press Withdraw on post `id`, as the form does: `next` is the page it sits on. */
export function withdrawPost(cookie: string, id: number | string, next?: string, origin = baseUrl): Promise<Response> {
  const body = new URLSearchParams();
  if (next !== undefined) body.set("next", next);
  return fetch(new URL(`/posts/${id}/withdraw`, origin), {
    method: "POST",
    headers: { origin, cookie },
    body,
    redirect: "manual",
  });
}
