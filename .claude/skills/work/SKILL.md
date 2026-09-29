---
name: work
description: Work one build issue end to end — claim it, trace UI→route→DB→UI, build with /tdd where useful, run the gates, review, push/deploy/probe, and hand off with evidence for Matt's acceptance.
argument-hint: "[issue-number]"
disable-model-invocation: true
model: sonnet
---

# Work: one issue, verified, handed off

## 1. Resume and claim

- Read the SessionStart summary, then `gh issue view N --comments` (its last
  handoff comment is where the work stands). With no number, run
  `scripts/frontier.sh build <spec>` and take the lowest-numbered issue.
- Claim: `gh issue edit N --add-assignee @me --add-label in-progress --remove-label ready-for-agent`.
- The issue's acceptance lines and the decision records are the whole brief.
  A behaviour they don't settle is Matt's call: ask, don't choose.

## 2. Trace and build

- Trace the path the slice crosses: page (`src/pages/`) → API route
  (`src/pages/api/`) → `src/lib/db.ts` → `src/lib/schema.ts` → back to the
  page. Name the files before editing.
- Confirm the issue's proposed test seam; if it must change, say why in an
  issue comment. Use `/tdd` for behaviour testable at that seam.
- Schema change: edit `schema.ts`, `pnpm db:generate`, commit schema and
  migration together. New page: add it to `spec/routes.ts`.
- Small commits, each `Refs #N`.

## 3. Verify (all before handoff; record exact output)

- `pnpm check` and `pnpm db:check`; `pnpm e2e` for anything a browser sees.
- Reviewer when the change touches schema/migrations, deploy shape
  (`astro.config.ts`, `db.ts`, SSE, routes), spec tests, or closes a milestone:
  `scripts/review-bundle.sh diff origin/main`, then the `reviewer` agent with
  the bundle path, the issue number, its acceptance lines and the seam. Fix
  blockers; record the disposition of every finding.
- A new bug or request found on the way: file it with the report template
  (`needs-triage`) and carry on. A harness gap: tell Matt and suggest
  `/harness-fix`.

## 4. Ship and probe

- `git push`. `pnpm check:evidence`: record the result (it passes only once
  PROCESS.md and the reflection exist; it must pass before the crit deploy).
- Deploy when gates are green: `flyctl deploy --remote-only --ha=false -a comp4020-crit7-mattxreynolds`,
  then `pnpm probe`. Record the output.

## 5. Hand off, then stop

Write `.scratch/handoff.md` and post it as the issue comment, attaching the
two screenshots from the e2e run:

```
gh issue comment N --body-file .scratch/handoff.md \
  --attach 'test-results/screenshots/desktop-<name>.png#1920×1080' \
  --attach 'test-results/screenshots/mobile-<name>.png#390×844'
```

The handoff holds: tested SHA; exact `pnpm check`, `pnpm db:check`, `pnpm e2e`
and `pnpm check:evidence` results; reviewer findings and dispositions; deploy
and probe output; each acceptance line → how it was verified; anything
unverified, said plainly; any exception to one-issue-per-session; next step.
Then `gh issue edit N --add-label ready-for-human --remove-label in-progress`.
After the handoff is posted, tick (`- [x]`) each acceptance line in the issue
body that you verified, via `gh issue view N --json body` and
`gh issue edit N --body-file`. Leave unticked any line that needs Matt's
judgement (screenshots, "reads well") or that you did not verify. A ticked box
means verified, not accepted.
Implemented and verified is not accepted: Matt accepts and closes.
