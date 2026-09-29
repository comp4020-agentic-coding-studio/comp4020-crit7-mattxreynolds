import type { APIRoute } from "astro";
import { safeNextPath } from "../../../lib/auth";
import { addComment } from "../../../lib/comments";

const STATUS = { "not-found": 404, "not-open": 409, invalid: 400 } as const;

// Comment on a swap post (0026). The form carries the text in `body` and says
// which page it sits on in `next`; the student goes back there (0029, 0045),
// and a `next` that isn't a path on this site goes to the board. Every rule is
// enforced here, whatever the form allowed.
export const POST: APIRoute = async ({ locals, params, request, redirect }) => {
  const student = locals.student;
  if (!student) return redirect("/login/");

  // a body that isn't a form is an empty comment, refused below
  const form = await request.formData().catch(() => new FormData());
  const id = /^[0-9]+$/.test(params.id ?? "") ? Number(params.id) : null;
  const result = id === null ? null : addComment(student.id, id, String(form.get("body") ?? ""));
  if (result === null || !result.ok) {
    return new Response(result?.error ?? "There is no swap post with that number.", {
      status: result === null ? 404 : STATUS[result.reason],
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }
  return redirect(safeNextPath(String(form.get("next") ?? "")), 303);
};
