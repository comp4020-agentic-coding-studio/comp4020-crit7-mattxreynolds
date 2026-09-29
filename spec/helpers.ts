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

/** Press "Offer to swap" on post `id`, as the form does: the offered class and the page it sits on. */
export function submitOffer(
  cookie: string | null,
  id: number | string,
  fields: { class?: string; next?: string } = {},
  origin = baseUrl,
): Promise<Response> {
  const body = new URLSearchParams();
  if (fields.class !== undefined) body.set("class", fields.class);
  if (fields.next !== undefined) body.set("next", fields.next);
  return fetch(new URL(`/posts/${id}/offers`, origin), {
    method: "POST",
    headers: cookie ? { origin, cookie } : { origin },
    body,
    redirect: "manual",
  });
}

/** Press Withdraw on offer `id`: `next` is the page it sits on. */
export function withdrawOffer(cookie: string | null, id: number | string, next?: string, origin = baseUrl): Promise<Response> {
  const body = new URLSearchParams();
  if (next !== undefined) body.set("next", next);
  return fetch(new URL(`/offers/${id}/withdraw`, origin), {
    method: "POST",
    headers: cookie ? { origin, cookie } : { origin },
    body,
    redirect: "manual",
  });
}

/** The id of the student's pending offer on post `postId`, read from the Withdraw form on the post page. */
export async function ownOfferId(cookie: string, postId: number | string, origin = baseUrl): Promise<number | null> {
  const doc = await page(`/posts/${postId}/`, cookie, origin);
  const action = doc.querySelector('form[action^="/offers/"]')?.getAttribute("action");
  const id = action?.match(/^\/offers\/(\d+)\/withdraw$/)?.[1];
  return id ? Number(id) : null;
}

/** Submit the confirm step's form for offer `id`: `confirm` is what its button sends. */
export function acceptOffer(
  cookie: string | null,
  id: number | string,
  fields: { confirm?: boolean } = { confirm: true },
  origin = baseUrl,
): Promise<Response> {
  const body = new URLSearchParams();
  if (fields.confirm) body.set("confirm", "yes");
  return fetch(new URL(`/offers/${id}/accept/`, origin), {
    method: "POST",
    headers: cookie ? { origin, cookie } : { origin },
    body,
    redirect: "manual",
  });
}

/** Press Decline on offer `id`: `next` is the page it sits on. */
export function declineOffer(cookie: string | null, id: number | string, next?: string, origin = baseUrl): Promise<Response> {
  const body = new URLSearchParams();
  if (next !== undefined) body.set("next", next);
  return fetch(new URL(`/offers/${id}/decline`, origin), {
    method: "POST",
    headers: cookie ? { origin, cookie } : { origin },
    body,
    redirect: "manual",
  });
}

/** The ids of the pending offers on post `postId`, in the order the poster sees them, read from their Decline forms. */
export async function offerIdsOn(cookie: string, postId: number | string, origin = baseUrl): Promise<number[]> {
  const doc = await page(`/posts/${postId}/`, cookie, origin);
  return [...doc.querySelectorAll('form[action$="/decline"]')].map((form) =>
    Number(form.getAttribute("action")?.match(/^\/offers\/(\d+)\/decline$/)?.[1]),
  );
}
