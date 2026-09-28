# 0042. The board updates live by refetching and swapping in its own server-rendered content

- Status: Accepted
- Date: 2026-09-28
- Decided by: Matt
- Source: #13

## Decision

- An open board (`/`, 0019) shows changes without a reload: new, edited,
  withdrawn and swapped posts, pending-offer and comment counts (0023,
  0028), the student's pinned "Your post", and "Your offers" statuses.
- When a board-relevant event arrives (0043), the board refetches itself
  over a logged-in request, as the same server-rendered HTML `/` returns,
  and swaps it in place. It also refetches whenever its event stream
  reconnects.
- The swap doesn't jump the scroll or move focus, doesn't show a flash
  notice (0019) again, and tells screen readers "Board updated" politely.
- The header's "Messages (N)" stays reload-only on every page, the board
  included (0034). The board does not refetch on "a private message was
  sent".
- With no JavaScript the board still works. It is simply correct on reload.

## Reason

Matt took the recommendations for Q1, Q3 and Q5 ("yes"). The crit demo is
accept/decline across two tabs, and the demo seed gives alex two pending
offers so the cascade can be shown (0038). A board that stays stale there is
what a viewer notices. One render path means a live board and a reloaded
board can't disagree, and the board has no text fields to lose. The machine
auto-stops (`fly.toml`, `min_machines_running = 0`), so events can be missed
while a stream is down, and refetching on reconnect covers that. The
private-message event has no id (0034), so the board would have to refetch
on every private message anyone sends, and its header would be live only on
`/`.

## Consequences

- The board is the second page with an `/api/events` listener, after the post
  page (0029) and the conversation page (0034).
- A logged-out request for the board content is refused like every other
  page (0013).
- The e2e flow can check a change in one browser context reaching another
  context's board with no reload.
