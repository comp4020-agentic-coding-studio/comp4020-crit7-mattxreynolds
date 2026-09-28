# 0013. Everything is behind the login except the README, login and sign-up

- Status: Accepted
- Date: 2026-09-28
- Decided by: Matt
- Source: #5

## Decision

A logged-out visitor can reach only `/readme/`, the login page and the
sign-up page. Any other page sends them to the login page, and after logging
in they land on the page they first asked for.

## Reason

Matt on Q5: "I think I want everything behind the login. Make it easy to
select a demo account and get in to see though." Q9: accepted the
recommendation, so a shared link to a swap post still works once logged in.
`/readme/` stays public because the permanent README check fetches it
without logging in (`spec/readme.test.ts`).

## Consequences

The invariants fetch `spec/routes.ts` routes logged out, so protected routes
would be checked as the login page. How the logged-in pages get invariant and
accessibility coverage is an implementation question for the login slice.
The easy way in is 0014.
