import type { APIRoute } from "astro";
import { safeNextPath } from "../../../lib/auth";
import { deleteComment } from "../../../lib/comments";

const STATUS = { "not-found": 404, forbidden: 403, "not-open": 409, "already-deleted": 409 } as const;

// Delete a comment (0027): the author's one click, while the post is open. The
// form says which page it sits on in `next` and the student goes back there
// (0045); a `next` that isn't a path on this site goes to the board.
export const POST: APIRoute = async ({ locals, params, request, redirect }) => {
  const student = locals.student;
  if (!student) return redirect("/login/");

  const id = /^[0-9]+$/.test(params.id ?? "") ? Number(params.id) : null;
  const result = id === null ? null : deleteComment(student.id, id);
  if (result === null || !result.ok) {
    return new Response(result?.error ?? "There is no comment with that number.", {
      status: result === null ? 404 : STATUS[result.reason],
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }
  // read only now the comment is deleted, so a body that isn't a form can't
  // turn a refusal into a 500
  const form = await request.formData().catch(() => new FormData());
  return redirect(safeNextPath(String(form.get("next") ?? "")), 303);
};
