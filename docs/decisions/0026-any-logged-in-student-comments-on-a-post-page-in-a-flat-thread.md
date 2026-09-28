# 0026. Any logged-in student can comment on an open swap post's page, in one flat thread, oldest first

- Status: Accepted
- Date: 2026-09-28
- Decided by: Matt
- Source: #10

## Decision

- **Who:** any logged-in student can comment on an **open** swap post,
  including its poster. Each comment shows its author's username and when it
  was written (e.g. "Mon 28 Sep, 14:05"). The poster's own comments carry a
  "poster" tag.
- **What:** a comment is plain text, 1–500 characters, shown exactly as
  written (escaped, with line breaks kept). These are the same rules as a
  post message (0016).
- **Where:** on the post page (0020), in one flat thread, oldest first. It
  sits below the post, and below the offers section in the poster's view
  (0023). The comment box is at the bottom.
- **Closed posts:** a withdrawn or swapped post's page still shows its
  comments, read-only, with no comment box.

## Reason

Matt took the recommendations for Q1, Q2, Q3 and Q5 ("yes"). The site is
already login-only (0013), so "logged-in students" is everyone who can see
the post. Open comments are the "discussable" part of 0007, and private talk
is #11. A flat thread reads like a conversation and keeps slice 4 small for
the 30 Sep cutoff (0009). The "poster" tag makes a back-and-forth easy to
follow. Once a post is withdrawn or swapped there is nothing left to
discuss in public. Keeping the thread read-only means links and history
still work (0020), and talk after a swap moves to private messages.

## Consequences

- The schema gains a comments table (post, author, body, created time,
  deleted time) via `pnpm db:generate`.
- The server rejects: an empty comment or one over 500 characters, a
  comment on a post that isn't open, and any comment from a logged-out
  visitor.
- Comments never lock a post for editing. Only pending offers do (0018).
  The post's "edited" marker tells readers the post may have changed since
  a comment was written.
- Terms fixed in `CONTEXT.md`: comment.
