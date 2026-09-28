---
name: harness-fix
description: Turn a real failure the harness let through into the smallest sensor, skill or rule correction, proven on the original case. Never for hypothetical or manufactured failures.
argument-hint: "<what went wrong, with its issue/commit>"
disable-model-invocation: true
model: opus
---

# Harness fix: a real failure becomes a correction

## Precondition

A failure that actually happened in this repo: an issue, commit, check
output or transcript excerpt shows it. If there is none, stop. Don't stage a
failure to exercise this skill.

## Steps

1. Open an issue from `.github/ISSUE_TEMPLATE/harness.md` (`--label harness
   --milestone C7`) stating the failure with its evidence. Claim it.
2. Find why the harness let it through: which sensor was missing, which
   skill step was skipped or wrong, which rule was absent or ignored. Read
   the relevant `.claude/` file, hook, script or check.
3. Choose the smallest correction, in this order of preference:
   a check or test that fails on it (`spec/`, `scripts/*.test.ts`, `pnpm
   db:check`, e2e) → a hook (`.claude/hooks/`, `.githooks/`) → a skill step →
   a `CLAUDE.md` rule. `CLAUDE.md` stays near 40 lines: adding a rule means
   merging or removing one.
4. **Prove it**: show the correction catching the original case (the test or
   hook failing, exit code included) and passing on correct input. Hooks get a
   case in `scripts/hooks.test.ts`.
5. Show Matt the diff and the proof before committing. Commit
   `harness: <what it now catches>` with `Refs #N`; `pnpm check` green.
6. Hand off on the issue with the proof, label `ready-for-human`. Matt
   decides whether to keep, change or drop the correction.
