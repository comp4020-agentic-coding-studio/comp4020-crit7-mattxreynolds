---
name: slice
description: Break a spec issue into vertical build issues (sub-issues labelled slice), each with acceptance lines, a proposed test seam, native blockers and the milestone.
argument-hint: "<spec-issue-number>"
disable-model-invocation: true
model: opus
---

# Slice: vertical build issues from a spec

1. Read the spec (`gh issue view $ARGUMENTS`), its decisions, `src/lib/schema.ts`
   and the app's routes. Slices come only from the spec's rules: nothing new.
2. Draft tracer-bullet slices. Each cuts one narrow, complete path, UI → route
   → database → UI, is demoable alone, and fits one session. The first slice
   is the smallest persistent core flow (for C7: post a swap offer and find it
   after a reload). Wide mechanical changes (a column rename across the app)
   are the exception: expand → migrate → contract as separate issues.
3. For each slice, in `.github/ISSUE_TEMPLATE/build-issue.md`'s sections:
   behaviour in `CONTEXT.md` words; acceptance lines, each naming how it is
   verified (spec test, e2e, db check, live probe, Matt's judgement); a
   **proposed test seam** (the public boundary, e.g. the HTTP route against
   the built server, and why); the expected trace; blockers.
4. Ask Matt, as a numbered list with recommendations, about granularity,
   order and blocking edges. Change the draft to his answers.
5. Create each: `gh issue create --parent $ARGUMENTS --label slice
   --label ready-for-agent --milestone C7 --blocked-by <n,…> --body-file …`.
6. Show `scripts/frontier.sh build $ARGUMENTS`. Next step: `/work` on the
   first frontier issue, in a fresh Sonnet session.
