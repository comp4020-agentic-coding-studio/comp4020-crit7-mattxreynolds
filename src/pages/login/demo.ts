import type { APIRoute } from "astro";
import { demoStudent, safeNextPath, startSession } from "../../lib/auth";

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const form = await request.formData();
  const choice = String(form.get("username") ?? "");
  const next = safeNextPath(String(form.get("next") ?? ""));

  const student = demoStudent(choice);
  if (!student) {
    const params = new URLSearchParams({ next, error: "That is not a demo student." });
    return redirect(`/login/?${params}`, 303);
  }

  startSession(cookies, request, student.id);
  return redirect(next, 303);
};
