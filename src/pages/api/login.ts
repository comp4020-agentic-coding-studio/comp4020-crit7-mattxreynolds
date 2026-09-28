import type { APIRoute } from "astro";
import {
  createSession,
  isSecureRequest,
  logIn,
  safeNextPath,
  SESSION_COOKIE,
  SESSION_DURATION_MS,
} from "../../lib/auth";

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const form = await request.formData();
  const username = String(form.get("username") ?? "");
  const password = String(form.get("password") ?? "");
  const next = safeNextPath(String(form.get("next") ?? ""));

  const student = logIn(username, password);
  if (!student) {
    const params = new URLSearchParams({
      next,
      error: "Incorrect username or password.",
    });
    return redirect(`/login/?${params}`, 303);
  }

  const { token } = createSession(student.id);
  cookies.set(SESSION_COOKIE, token, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: isSecureRequest(request),
    maxAge: SESSION_DURATION_MS / 1000,
  });
  return redirect(next, 303);
};
