# 0021. The starter's guestbook tests retire in the login slice

- Status: Accepted
- Date: 2026-09-28
- Decided by: Matt
- Source: #8

## Decision

`spec/guestbook.test.ts` and `e2e/guestbook.spec.ts` are removed in the
login slice, the first slice built (0009), along with the guestbook page and
`/api/messages`. The slices' own reload and e2e tests replace them.

## Reason

Matt accepted the recommendation in #8 ("yes", Q3). CLAUDE.md makes retiring
the guestbook tests his call. Once `/` is behind the login (0013), the tests
can't pass wherever the board goes. Keeping a public guestbook just to keep
them green would mean editing the guarded tests and would contradict 0013.

## Consequences

- The login slice's issue lists this removal in its acceptance lines, and
  the reviewer checks it (it's a spec-test change).
- The SSE plumbing (`/api/events`, `src/lib/events.ts`) stays until the
  "live updates" fog on #2 is decided.
