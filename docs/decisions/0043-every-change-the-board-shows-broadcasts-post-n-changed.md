# 0043. Every change the board shows broadcasts the content-free "post N changed" event

- Status: Accepted
- Date: 2026-09-28
- Decided by: Matt
- Source: #13

## Decision

- Each of these broadcasts "post N changed" on `/api/events`, with only the
  post id and a kind, as 0029 defines for comments:
  - a swap post created, edited, withdrawn or swapped
  - an offer made, withdrawn, accepted, declined or closed
  - a comment added or deleted
- When one action changes several posts (an accept closes the offerer's own
  post and other offers, 0024), each affected post gets its event.
- The event carries no username, class, message, comment or offer detail.

## Reason

Matt took the recommendation for Q2 ("yes"). `/api/events` is public because
CI and `pnpm probe` fetch it logged out (0029), so anything on it can be read
without logging in (0013). One event shape serves both the board (0042) and
the post page (0044). It leaks only when a post changed, which 0029 already
accepts for comments.

## Consequences

- The starter's guestbook event goes when the guestbook does (0021). The bus
  carries post events and the id-less private-message event (0034).
- A test checks that no username, class or text reaches `/api/events` when
  a post, an offer or a comment changes.
