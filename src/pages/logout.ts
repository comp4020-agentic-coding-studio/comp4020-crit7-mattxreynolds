import type { APIRoute } from "astro";
import { deleteSession, SESSION_COOKIE } from "../lib/auth";

// A plain POST + redirect, like every other form action here: no client-side
// JavaScript needed, and Astro's same-origin Origin check (astro.config.ts)
// is the CSRF protection.
export const POST: APIRoute = ({ cookies, redirect }) => {
  const token = cookies.get(SESSION_COOKIE)?.value;
  if (token) deleteSession(token);
  cookies.delete(SESSION_COOKIE, { path: "/" });
  return redirect("/", 303);
};
