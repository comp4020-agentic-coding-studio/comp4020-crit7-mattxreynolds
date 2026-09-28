# 0034. An open conversation shows new private messages live, and the public stream says only that one was sent

- Status: Accepted
- Date: 2026-09-28
- Decided by: Matt
- Source: #11

## Decision

- When a private message is sent, any open copy of that conversation's page
  shows it without a reload.
- The broadcast on `/api/events` says only "a private message was sent".
  It carries no id, username or text. Each open conversation page then
  fetches its thread over a logged-in request.
- The sender is sent back to the conversation with a 303 redirect, so
  sending works with no JavaScript.
- The header count and the inbox (0033) update on reload only.

## Reason

Matt took the recommendation for Q5 ("yes"). `/api/events` is public
because CI and `pnpm probe` fetch it logged out (0029), so anything on it
can be read without logging in. An event with no id or username leaks only
the time something was sent, not who is talking to whom. This reuses the
comment pattern (0029), and a conversation is where live updates matter
most. Keeping the count and inbox reload-only keeps the SSE listener off
every page.

## Consequences

- There is a logged-in route that returns the viewer's conversation with one
  student. It refuses logged-out visitors (0013), and it can only ever return
  the viewer's own messages (0031).
- A test checks that no private message text, username or id reaches
  `/api/events`.
- Whether the board updates live is the last live-update question on map #2.
