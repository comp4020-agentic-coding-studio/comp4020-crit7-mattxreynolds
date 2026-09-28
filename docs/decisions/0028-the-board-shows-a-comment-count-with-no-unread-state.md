# 0028. The board shows each post's comment count, with no unread state

- Status: Accepted
- Date: 2026-09-28
- Decided by: Matt
- Source: #10

## Decision

- Each board entry (0019) and the pinned "Your post" show "N comments",
  next to the pending-offer count (0023). Deleted comments are not counted.
- There is no unread or "new since you last looked" state, and no
  notification of new comments.

## Reason

Matt took the recommendation for Q6 ("yes"). A count shows which posts are
being discussed, which is the visibility 0007 argues for, and costs one
count query. Unread tracking needs a per-student "last seen" record, which
doesn't fit the 30 Sep cutoff (0009).

## Consequences

- The board query counts comments alongside pending offers.
- A poster finds new comments by opening their post page from "Your post".
