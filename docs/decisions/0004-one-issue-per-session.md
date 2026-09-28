# 0004. One issue per session by default

- Status: Accepted
- Date: 2026-09-28
- Decided by: Matt
- Source: #1

## Decision

A session claims and works one issue. Documented exceptions: research
tickets (several may run in parallel), and opening new issues without working
them (a bug found mid-slice filed for `/triage`, or a map's decision issues
charted by `/wayfinder`). Any other exception is recorded in that session's
handoff with its reason.

## Reason

Marathon sessions in earlier work compressed context and blurred which
change served which goal.

## Consequences

Each handoff comment names the one issue it advanced, so commits, evidence
and acceptance line up per issue.
