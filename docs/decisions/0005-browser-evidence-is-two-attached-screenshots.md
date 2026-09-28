# 0005. Browser evidence is two screenshots attached to the issue

- Status: Accepted
- Date: 2026-09-28
- Decided by: Matt
- Source: #1

## Decision

A browser-facing slice's evidence is two screenshots from `pnpm e2e`, one at
1920×1080 and one at 390×844, attached to the issue's handoff comment with
`gh issue comment N --body-file … --attach … --attach …` (GitHub CLI ≥ 2.99.0).
There is no committed `evidence/` folder.

## Reason

Prose claims of visual checks were the audit's main weakness; an attached
image on the issue is durable and sits next to the claim, without bloating
the repo with images that go stale.

## Consequences

Playwright writes screenshots under `test-results/` (gitignored), and the
handoff attaches them from there.
