# 0044. A post page updates its status and offers live on the same event as its comments

- Status: Accepted
- Date: 2026-09-28
- Decided by: Matt
- Source: #13

## Decision

- When "post N changed" arrives (0043), an open copy of post N's page
  refetches its status (open, withdrawn or swapped), its pending-offer count,
  and what the viewer sees of its offers (0023), as well as its comments
  (0029).
- The comment box is left alone, so half-typed text survives the refresh.
- Like the board, it refetches over a logged-in request and also refetches
  when its stream reconnects.

## Reason

Matt took the recommendation for Q4 ("yes"). The post page already listens
for "post N changed" to refresh its comments (0029), so refreshing the rest
of it costs no new event. Without this, after alex accepts, sam's post page
in the second tab would still say "pending".

## Consequences

- This widens 0029, which was about comments only. It doesn't supersede
  it: 0029's stream rule and 303 redirect still hold.
- Controls that no longer apply (Offer, Withdraw, Accept/Decline after a
  swap) disappear on the refresh. A stale form posted anyway is refused by
  the server, as it is today.
