# 0002. Opus for decisions, Sonnet for routine work and review

- Status: Accepted
- Date: 2026-09-28
- Decided by: Matt
- Source: #1

## Decision

Claude Code runs through the course proxy. Sessions that shape decisions
(`/wayfinder`, `/grill`, `/prototype`, `/spec`, `/slice`, `/harness-fix`) run on
Opus (`/model opus`). Routine implementation and triage (`/work`, `/tdd`,
`/triage`) run on Sonnet (`/model sonnet`), as do the reviewer and
evidence-auditor agents.

## Reason

The proxy budget is weekly. Decisions are few and costly to get wrong;
implementation inside an agreed, tested slice is many small steps where
Sonnet is sufficient.

## Consequences

Decision skills set `model: opus` and routine skills `model: sonnet` in their
frontmatter; that override lasts one turn, so a multi-turn session switches
with `/model` as well.
