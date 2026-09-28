# 0003. Matt decides product behaviour and alone accepts work

- Status: Accepted
- Date: 2026-09-28
- Decided by: Matt
- Source: #1

## Decision

Matt decides product behaviour and final acceptance. Claude may choose
routine implementation and test seams within an agreed issue. Implemented,
verified and accepted are separate states: Claude implements and verifies,
labels the issue `ready-for-human`, and stops. Matt accepts or rejects, and
closes issues himself, decision issues included (his answer closes them).

## Reason

The recurring failure in earlier work was the agent inventing unrequested
design calls and declaring its own work done.

## Consequences

Commits never use closing keywords (`.githooks/commit-msg`) and Claude never
runs `gh issue close` (`.claude/hooks/guard.mjs`). A behaviour missing from an
issue's acceptance lines or a decision record is a question for Matt, not a
choice for Claude.
