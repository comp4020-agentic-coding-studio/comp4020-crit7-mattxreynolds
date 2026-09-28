# 0027. A comment cannot be edited, and only its author can delete it, leaving a placeholder

- Status: Accepted
- Date: 2026-09-28
- Decided by: Matt
- Source: #10

## Decision

- A comment cannot be edited.
- Its author can delete it from the post page while the post is open. The
  thread then shows a "Comment deleted" placeholder where it was, with no
  author or text.
- The poster cannot delete other people's comments, and no one else can
  either.
- On a withdrawn or swapped post, comments can't be deleted (0026).

## Reason

Matt took the recommendation for Q4 ("yes"). Without editing, nobody's
words change after someone has replied to them. Deleting still lets a
student take back something they regret. The placeholder keeps a flat
thread (0026) readable when a later comment answered the deleted one.
Moderation by the poster is left out to keep slice 4 small (0009).

## Consequences

- Deleting is a soft delete: the row keeps its place in the thread with a
  deleted time, and its text is no longer shown or sent.
- The server rejects a delete from anyone but the author, and any delete on
  a post that isn't open.
- Deleted comments don't count towards the comment count (0028).
