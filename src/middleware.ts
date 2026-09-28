import { defineMiddleware } from "astro:middleware";
import { getStudentForToken, safeNextPath, SESSION_COOKIE } from "./lib/auth";

// Everything is behind the login except the README, the login page and the
// sign-up page (0013). "/" is the one exception to the redirect itself: a
// logged-out visitor gets the login page in place, with a 200, because the
// deploy probe and the link check both fetch "/" without following redirects
// (0048) — src/pages/index.astro renders the login form when there's no
// student. Every other protected path redirects to /login/?next=….
// /api/events is public too: it's plumbing, not a student-facing page, and
// the deploy probe and CI's link check both fetch it without logging in.
const PUBLIC_PATHS = new Set([
  "/readme/",
  "/login/",
  "/signup/",
  "/api/login",
  "/login/demo",
  "/api/signup",
  "/api/events",
]);

export const onRequest = defineMiddleware((context, next) => {
  const token = context.cookies.get(SESSION_COOKIE)?.value;
  context.locals.student = token ? getStudentForToken(token) : null;

  const path = context.url.pathname;
  if (context.locals.student || PUBLIC_PATHS.has(path) || path === "/") {
    return next();
  }

  const target = safeNextPath(path + context.url.search);
  return context.redirect(`/login/?next=${encodeURIComponent(target)}`);
});
