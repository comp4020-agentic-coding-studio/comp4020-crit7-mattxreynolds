---
name: wayfinder
description: Chart or continue a bounded decision map (wayfinder:map issue) whose children are decisions, never build tasks. Use to start planning an effort, or with a map number to see its decision frontier and route the next decision.
argument-hint: "[map-issue-number | destination]"
disable-model-invocation: true
model: opus
---

# Wayfinder: map the decisions, not the build

Wayfinder plans; it does not do. Every child issue asks a question whose
answer is a decision. The map is done when nothing is left to decide before
someone builds the thing. Pattern: Pocock's wayfinder
(github.com/mattpocock/skills, docs/engineering/wayfinder.md), on GitHub
Issues with native sub-issues and blocked-by links.

## Continue a map (`$ARGUMENTS` is a number)

1. `gh issue view $ARGUMENTS --comments` and `scripts/frontier.sh decisions $ARGUMENTS`.
2. Show Matt the frontier and recommend one ticket to take next, by name, and
   the skill that resolves it: `wayfinder:grilling` → `/grill #N`;
   `wayfinder:prototype` → `/prototype #N`; `wayfinder:research` → dispatch a
   subagent now to find the fact, post its sourced answer on the ticket;
   `wayfinder:task` → do it if Claude can, else give Matt a checklist.
3. If the frontier and the fog are both empty, the map is cleared: say so and
   point to `/spec #map`. Do not start building.

## Chart a new map

1. Ground first, and find facts yourself: the published brief and spec
   (course site), `spec/README.md`, `CONTEXT.md`, `docs/decisions/`,
   `docs/c7-brainstorm.md`, `src/lib/schema.ts`. Never ask Matt a fact.
2. Draft the **Destination** in one or two sentences and confirm it with Matt
   before anything else. It bounds the map: a question that does not lie
   between here and the destination is out of scope.
3. Draft, in the `decision-map` template's sections: **Decisions so far**
   (already-recorded decisions, linked), each child decision (one precise
   question, type, what it blocks, facts found with sources, a recommended
   answer), **Not yet specified** (fog: can't yet be phrased precisely),
   **Out of scope**. Keep the first frontier small: three to six children.
4. Show Matt the whole draft. Create nothing until he agrees.
5. Create: the map (`gh issue create --label wayfinder:map --milestone C7
   --body-file …`), then each child with `--parent <map>`, its
   `wayfinder:<type>` label, and `--blocked-by` for prerequisites. Bodies
   follow `.github/ISSUE_TEMPLATE/decision.md`.
6. Run `scripts/frontier.sh decisions <map>` and show the result.

## Rules

- No build tasks or slices on the map; `task` only unblocks a decision.
- HITL tickets resolve only through Matt's live answers. Never answer them.
- Matt's answer closes each decision issue; Claude never closes issues.
- Refer to tickets by name as well as number.
- Commit any repo change with `Refs #<map>`.
