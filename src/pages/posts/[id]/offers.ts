import type { APIRoute } from "astro";
import { safeNextPath } from "../../../lib/auth";
import { makeOffer } from "../../../lib/offer-store";

const STATUS = { "not-found": 404, "own-post": 403, "class-not-joinable": 400 } as const;

// Offer to swap on a swap post (0022). The form names the offered class and
// says which page it sits on in `next`; the student goes back there (0045),
// and a `next` that isn't a path on this site goes to the board. Every rule is
// enforced here, whatever the form allowed.
export const POST: APIRoute = async ({ locals, params, request, redirect }) => {
  const student = locals.student;
  if (!student) return redirect("/login/");

  // a body that isn't a form is an offer naming no class, refused below
  const form = await request.formData().catch(() => new FormData());
  const id = /^[0-9]+$/.test(params.id ?? "") ? Number(params.id) : null;
  const result = id === null ? null : makeOffer(student.id, id, String(form.get("class") ?? ""));
  if (result === null || !result.ok) {
    const status = result === null ? 404 : (STATUS[result.reason as keyof typeof STATUS] ?? 409);
    return new Response(result?.error ?? "There is no swap post with that number.", {
      status,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }
  return redirect(safeNextPath(String(form.get("next") ?? "")), 303);
};
