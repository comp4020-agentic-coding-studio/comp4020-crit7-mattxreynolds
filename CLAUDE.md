# Harness contract

C7: a slice of a real ANU system (tutorial swaps), full-stack on Astro +
Drizzle + SQLite, deployed to `comp4020-crit7-mattxreynolds.fly.dev`. The brief
and spec are on the course site; `spec/README.md` explains the shipped checks.

## Authority

- Matt decides product behaviour and accepts work. Claude chooses
  implementation and test seams inside an agreed issue, nothing more. A
  behaviour no issue or `docs/decisions/` record settles is a question for
  Matt, asked with a recommendation, never a choice made quietly.
- Implemented, verified and accepted are separate. Claude stops at verified:
  label `ready-for-human`. Only Matt closes issues, decision issues included.
- Facts are Claude's to find (code, schema, sources); decisions are Matt's.
- `/model opus` for decisions (wayfinder, grill, prototype, spec, slice,
  harness-fix); `/model sonnet` for work, tdd, triage and reviews.

## Records

- GitHub Issues are the durable record; `.scratch/` is disposable memory.
  Resume from the SessionStart summary, the issue's last handoff, the log.
- One issue per session (exceptions: `docs/decisions/0004`).
- Flow: `/wayfinder` → `/grill` | `/prototype` → `/spec` → `/slice` → `/work`
  (+ `/tdd`); `/triage` for new reports; `/harness-fix` for real failures.
- Ground truth: `src/lib/schema.ts` (data), `CONTEXT.md` (words, used in code),
  `docs/decisions/` (one decision per file).

## Gates and evidence

- Before any handoff: `pnpm check`, `pnpm db:check`, and `pnpm e2e` for
  anything a browser sees. Report exact results; never claim an unrun command.
- Reviewer agent (`scripts/review-bundle.sh` → `reviewer`) for schema,
  migration, deploy-shape or spec-test changes and milestones.
- Browser evidence: the two e2e screenshots (1920×1080, 390×844) attached to
  the handoff comment with `gh issue comment --attach`. No `evidence/` folder.
- After a deploy: `pnpm probe`. `pnpm check:evidence` must pass before the
  crit. Cite commits in PROCESS.md with `pnpm cite <issue>`.

## Never

- Weaken or edit the permanent checks, CI, `fly.toml`, the Dockerfile,
  committed migrations or boot-time `migrate()` (`.claude/hooks/guard.mjs`
  blocks these). New pages go in `spec/routes.ts`; schema changes go through
  `pnpm db:generate`. Retiring the guestbook tests is Matt's call.
- Closing keywords in commits (use `Refs #N`), amend, rebase, force-push,
  `--no-verify`, or committing anything secret.
