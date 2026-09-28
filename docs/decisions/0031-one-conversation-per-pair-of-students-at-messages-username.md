# 0031. There is one conversation per pair of students, at `/messages/<username>/`, and it isn't tied to a post

- Status: Accepted
- Date: 2026-09-28
- Decided by: Matt
- Source: #11

## Decision

- A **conversation** is every private message between two students. There
  is exactly one per pair, whichever post they met on.
- It lives at `/messages/<username>/`, which always means "me and that
  student". It shows the messages oldest first, with the message box at the
  bottom.
- Private messages don't reference a swap post. A student can paste a post's
  URL into a message.
- Conversations outlive posts: withdrawing or swapping a post changes
  nothing in them.

## Reason

Matt took the recommendations for Q2 and Q7 ("yes"). The URL is relative to
the logged-in student, so there is no address for someone else's
conversation. Privacy holds because of how the route is built, not because of
an access check that could be forgotten. A conversation per pair outlives
any post, which the talk after a swap needs (0026). Bare "message" already
means the swap post's message (0016) and the guestbook's `messages` table
(`src/lib/schema.ts`), so the new words are "private message" and
"conversation".

## Consequences

- The schema gains a private messages table (sender, recipient, body,
  created time, read time: 0033) via `pnpm db:generate`. A conversation is a
  query over the table, not a row of its own.
- `/messages/<username>/` for an unknown username, or for your own, gives a
  404.
- Terms fixed in `CONTEXT.md`: private message, conversation. Code uses
  "private message" in full, never bare "message".
