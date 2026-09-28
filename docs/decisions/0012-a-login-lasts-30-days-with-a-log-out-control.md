# 0012. A login lasts 30 days on that browser, with a visible Log out

- Status: Accepted
- Date: 2026-09-28
- Decided by: Matt
- Source: #5

## Decision

Logging in keeps the student logged in on that browser for 30 days. Sessions
are stored in the database, so they survive redeploys. Every logged-in page
has a visible "Log out" control.

## Reason

Matt accepted the recommendation (Q4). A student comes back days later to
check offers on their swap post.

## Consequences

Input to #8 (where a student finds their swap post after reload): a returning
student is normally still logged in. The schema gains a sessions table.
