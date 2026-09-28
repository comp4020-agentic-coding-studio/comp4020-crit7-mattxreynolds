# 0046. Every time the app shows is in Canberra time

- Status: Accepted
- Date: 2026-09-28
- Decided by: Matt
- Source: #14

## Decision

Every time the app shows (posted, edited, withdrawn, comment and private
message times, as in "Mon 28 Sep, 14:05") is in Australia/Sydney time,
whatever timezone the server runs in. Class times (0010) are already local
times and are shown as published.

## Reason

Matt took the recommendation ("Canberra time"). The deployed server runs in
UTC, so without a rule a post made at 14:05 would show as 04:05. The course
API gives its timezone as Australia/Sydney, and every student using the app
is at ANU.

## Consequences

- Times are stored as instants and formatted for Australia/Sydney when
  shown, including daylight saving.
- A test pins one known instant to its Canberra rendering.
