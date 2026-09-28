# 0029. New comments appear live on an open post page, and the public stream never carries their text

- Status: Accepted
- Date: 2026-09-28
- Decided by: Matt
- Source: #10

## Decision

- When a comment is added or deleted, every open copy of that post's page
  shows the change without a reload.
- The broadcast on `/api/events` says only which post changed (e.g. "post N
  has new comments"). A page showing that post then fetches its comments
  over a logged-in request.
- The student who submits a comment is sent back to the post page with a
  303 redirect, so commenting works with no JavaScript.
- This covers comments only. Whether the board or private messages update
  live is still open on map #2.

## Reason

Matt took the recommendation for Q7 ("yes"). `pnpm probe` and CI
(`.github/workflows/checks.yml:96`) fetch `/api/events` logged out and
expect bytes. The workflow can't be edited, so the stream stays public.
Anything broadcast on it can be read without logging in, so sending comment
text there would break 0013. A content-free event keeps the starter's
single stream and form-then-redirect pattern (`src/pages/api/messages.ts`).
It also makes a discussion feel live, which suits "discussable" (0007).

## Consequences

- There is a logged-in route that returns a post's comment thread. It
  refuses logged-out visitors like every other page (0013).
- The bus event names a post id and a kind, never a body or username.
  A test checks that no comment text reaches `/api/events`.
- The map's live-updates fog narrows to the board and private messages.
