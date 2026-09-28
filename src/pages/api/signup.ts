import type { APIRoute } from "astro";
import { safeNextPath, signUp, startSession } from "../../lib/auth";

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

  startSession(cookies, request, result.student.id);
  return redirect(next, 303);
};
