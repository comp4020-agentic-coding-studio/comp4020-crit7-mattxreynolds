import type { AstroCookies } from "astro";
import { isSecureRequest } from "./auth";

// A one-shot notice carried across a redirect (0019): set on the redirect
// response, read and cleared by the next page that renders it, so a reload
// doesn't show it again. Only these fixed keys map to text.
const FLASH_COOKIE = "flash";
const NOTICES = {
  "post-created": "Your swap post is on the board",
  "post-saved": "Changes saved",
} as const;
export type Flash = keyof typeof NOTICES;

export function setFlash(cookies: AstroCookies, request: Request, flash: Flash): void {
  cookies.set(FLASH_COOKIE, flash, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: isSecureRequest(request),
    maxAge: 60,
  });
}

export function takeFlash(cookies: AstroCookies): string | null {
  const value = cookies.get(FLASH_COOKIE)?.value;
  if (value === undefined) return null;
  cookies.delete(FLASH_COOKIE, { path: "/" });
  return Object.hasOwn(NOTICES, value) ? NOTICES[value as Flash] : null;
}
