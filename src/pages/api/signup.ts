import type { APIRoute } from "astro";
import {
  createSession,
  isSecureRequest,
  safeNextPath,
  SESSION_COOKIE,
  SESSION_DURATION_MS,
  signUp,
} from "../../lib/auth";

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const form = await request.formData();
  const username = String(form.get("username") ?? "");
  const password = String(form.get("password") ?? "");
  const next = safeNextPath(String(form.get("next") ?? ""));

  const result = signUp(username, password);
  if (!result.ok) {
    const params = new URLSearchParams({ next, error: result.error, username });
    return redirect(`/signup/?${params}`, 303);
  }

  const { token } = createSession(result.student.id);
  cookies.set(SESSION_COOKIE, token, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: isSecureRequest(request),
    maxAge: SESSION_DURATION_MS / 1000,
  });
  return redirect(next, 303);
};
