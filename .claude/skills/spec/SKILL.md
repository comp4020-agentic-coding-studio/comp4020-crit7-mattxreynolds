---
name: spec
description: Synthesise a cleared decision map into one parent spec issue (settled rules, numbers, exclusions, testing decisions). Makes no new decisions.
argument-hint: "<map-issue-number>"
disable-model-invocation: true
model: opus
---

# Spec: collapse a cleared map into one parent issue

## Precondition

`scripts/frontier.sh decisions $ARGUMENTS` shows an empty frontier, no
blocked or claimed children, and the map's fog section is empty. Every child
decision is closed by Matt. If not, stop and point to `/wayfinder $ARGUMENTS`.

## Synthesis

1. Read the map, every closed child with its resolution comment, the decision
   records they produced, `CONTEXT.md`, and the published C7 spec.
2. Draft the body in `.github/ISSUE_TEMPLATE/spec.md`'s sections:
   - **Rules**: settled behaviour, each line citing its decision (`#N` or
     `docs/decisions/NNNN`). A rule with no source is a new decision: stop,
     name the gap, and open a decision issue on the map instead.
   - **Numbers and limits**, **Exclusions** (from the map's out of scope).
   - **Testing decisions**: which lines are mechanically checkable (spec test,
     e2e, db check, live probe) and which only Matt can judge; candidate seams.
   - Use `CONTEXT.md` words; no file paths or code except where a prototype's
     snippet states a decision exactly.
3. Show Matt the draft; revise until he agrees it says what he decided.
4. `gh issue create --label spec --milestone C7 --body-file …`; comment on the
   map linking the spec. Matt closes the map. Next step: `/slice #spec`.
