# 0048. A logged-out visitor on `/` gets the login page in place, with a 200

- Status: Accepted
- Date: 2026-09-28
- Decided by: Matt
- Source: #15 (slicing)

## Decision

- A logged-out GET of `/` is answered with the login page itself, status
  200, at `/`. Logging in from it reloads `/`, so the student lands on the
  board they asked for (0013).
- Every other protected page redirects a logged-out visitor to
  `/login/?next=<the page>`, and logging in returns them there.

## Reason

Matt took the recommendation ("accept all the recommendations"). `pnpm
probe` and the CI deploy probe fetch `/` without following redirects and fail
on anything but 200, and the link check starts at `/`. Both are guarded and
can't change. Serving the login page at `/` keeps 0013 (a logged-out visitor
reaches only the README, login and sign-up) and keeps the probes green.

## Consequences

- The login slice implements this and tests both paths.
- `spec/invariants.test.ts` fetches `/` logged out, so it checks the login
  page there. The board's own invariant coverage comes from the logged-in
  spec test the login slice adds (0013).
