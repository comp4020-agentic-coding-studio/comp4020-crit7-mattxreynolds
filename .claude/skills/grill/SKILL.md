---
name: grill
description: Interview Matt in recommended-answer rounds until one decision issue (or topic) is settled, then record his answer, decision records and glossary terms.
argument-hint: "<decision-issue-number | topic>"
disable-model-invocation: true
model: opus
---

# Grill: settle one decision with Matt

Finding facts is Claude's job; decisions are Matt's.

## Start

1. `gh issue view $ARGUMENTS --comments`; read its map, `CONTEXT.md` and
   `docs/decisions/`. Claim it:
   `gh issue edit $ARGUMENTS --add-assignee @me --add-label in-progress`.
2. Look up every fact the question depends on (code, schema, brief, sources,
   a research subagent). Do not ask Matt anything you could find.
3. Build a design tree: the decision and the sub-decisions that hang off it.
   The round's frontier is every sub-decision whose prerequisites are settled.

## Rounds

Ask the whole frontier in one message, then wait:

```
❓ Q1. <precise question>
   ➡️ Recommended: <answer> — <one-line reason, citing the fact behind it>
   Other options: <brief>
```

Matt may reply "yes" to take all recommendations, or answer by number. Never
answer your own questions or assume an unanswered one. Keep asking rounds
until the frontier is empty. When a term's meaning gets fixed, say so.

## Record (after Matt's last answer)

1. Post a resolution comment on the issue: each question with Matt's answer
   quoted verbatim, and what follows from it.
2. Write `docs/decisions/NNNN-slug.md` per decision (`Decided by: Matt`,
   `Source: #N`). Move fixed terms into `CONTEXT.md` "decided terms".
3. Fog that can now be phrased precisely becomes new child decision issues
   (`--parent <map>`, `--blocked-by` as needed); remove it from the map's fog.
4. Add one line to the map's **Decisions so far**:
   `gh issue edit <map> --body-file …` (edit only that section).
5. Commit docs with `Refs #N`, push, then label the issue `ready-for-human`
   and remove `in-progress`. Matt closes it. One decision issue per session:
   stop here.
