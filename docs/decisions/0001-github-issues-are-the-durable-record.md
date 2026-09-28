# 0001. GitHub Issues are the durable record; .scratch/ is disposable

- Status: Accepted
- Date: 2026-09-28
- Decided by: Matt
- Source: #1; [task-tracking guidance](https://comp.anu.edu.au/courses/comp4020-agentic-coding-studio/topics/task-tracking/)

## Decision

Decisions, specs, build slices, bugs and their evidence live in this repo's
GitHub Issues, linked with native sub-issue and blocked-by relationships.
`.scratch/` (gitignored) holds session memory: the last handoff, review
bundles, screenshots before they are attached. Nothing in `.scratch/` is
evidence.

## Reason

In A1 and A2 a hand-kept markdown ledger bloated, and trimming it lost
verification evidence. Issues are permanent, public once the repo ships, and
their state can be queried, so the next task is computed (`scripts/frontier.sh`)
instead of curated.

## Consequences

Every commit cites its issue with `Refs #N`. A session resumes from the issue,
its last handoff comment and recent commits, not from a planning document.
