# 0055. Every screen gets a full redesign, and signup follows login's look

- Status: Accepted
- Date: 2026-09-29
- Decided by: Matt
- Source: #29 (map #27)

## Decision

Every screen gets a full redesign in the transit-board style, not only the
shared shell and tokens: the board, the post page, login, signup, new and edit
post, the accept step, the inbox, a conversation and About. Signup takes
login's look (the same panel and heading style) without the demo-student part.

## Reason

Matt on Q1, against the recommendation (full for the board, post page and
login; shell only for the rest): "Everything gets full redesign". He gave no
further reason, so none is recorded. Matt on Q2: "I like your recommendation".

## Consequences

- No screen is left at "shell only" by design. "Shell only" survives as the
  fallback in `0056`.
- About still renders the README text under its shipped spec test; a full
  redesign of it changes its layout, not its content.
- Behaviour, routes, schema and the accept step's confirm rule are unchanged
  (map #27, destination and out of scope).
- The post-page layout, and whether it reuses the exchange row, is not settled
  here; it is a separate decision issue under map #27.
- Terms fixed in `CONTEXT.md`: full redesign, shell only.
