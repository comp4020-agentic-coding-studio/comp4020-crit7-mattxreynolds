---
name: Build issue (slice)
about: One vertical slice, UI to route to database and back, demoable alone.
title: "Slice: "
labels: ["slice", "ready-for-agent"]
---

**Spec:** #   **Blocked by:** native links only

## Behaviour

<!-- What a user can do when this lands, in the domain's words (CONTEXT.md). -->

## Acceptance lines

<!-- Checkable lines Matt accepts against. Each says how it is verified:
     spec test, e2e, db check, live probe, or Matt's judgement. -->

- [ ]

## Proposed test seam

<!-- Claude's proposal: the public boundary the tests sit at (e.g. HTTP route,
     db function, rendered page) and why. Agreed before the first test. -->

## Trace

<!-- UI → route → db → UI: the files this slice is expected to touch. -->

## Evidence (on the handoff comment)

Tested SHA, exact `pnpm check` / `pnpm db:check` / `pnpm e2e` results,
reviewer disposition, live probe after deploy, and two screenshots
(1920×1080, 390×844) attached with `gh issue comment --attach`.
