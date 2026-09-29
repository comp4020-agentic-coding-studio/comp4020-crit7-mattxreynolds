import type { APIRoute } from "astro";
import { sendPrivateMessage } from "../../../lib/privateMessages";

const STATUS = { "not-found": 404, self: 400, invalid: 400 } as const;

// Send a private message (0030, 0032). The form carries the text in `body`;
// the sender goes back to the conversation with a 303 (0034), so sending works
// with no JavaScript. Every rule is enforced here, whatever the form allowed.
export const POST: APIRoute = async ({ locals, params, request, redirect }) => {
  const student = locals.student;
  if (!student) return redirect("/login/");

  // a body that isn't a form is an empty private message, refused below
  const form = await request.formData().catch(() => new FormData());
  const result = sendPrivateMessage(student.id, params.username ?? "", String(form.get("body") ?? ""));
  if (!result.ok) {
    return new Response(result.error, {
      status: STATUS[result.reason],
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }
  return redirect(`/messages/${encodeURIComponent(result.recipient)}/`, 303);
};
