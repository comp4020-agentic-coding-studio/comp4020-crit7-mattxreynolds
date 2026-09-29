import type { APIRoute } from "astro";
import { safeNextPath } from "../../../lib/auth";
import { declineOffer } from "../../../lib/offer-store";

// Decline an offer (0024): the poster's one click, with no reason. The form
// says which page it sits on in `next` and the poster goes back there (0045);
// a `next` that isn't a path on this site goes to the board.
export const POST: APIRoute = async ({ locals, params, request, redirect }) => {
  const student = locals.student;
  if (!student) return redirect("/login/");

  const id = /^[0-9]+$/.test(params.id ?? "") ? Number(params.id) : null;
  const result = id === null ? null : declineOffer(student.id, id);
  if (result === null || !result.ok) {
    const status = result === null || result.reason === "not-found" ? 404 : result.reason === "forbidden" ? 403 : 409;
    return new Response(result?.error ?? "There is no offer with that number.", {
      status,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }
  // read only now the offer is declined, so a body that isn't a form can't
  // turn a refusal into a 500
  const form = await request.formData().catch(() => new FormData());
  return redirect(safeNextPath(String(form.get("next") ?? "")), 303);
};
