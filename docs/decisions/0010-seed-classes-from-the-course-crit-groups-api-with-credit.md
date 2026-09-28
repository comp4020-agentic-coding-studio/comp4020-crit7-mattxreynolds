# 0010. Seed the classes from the course's crit-groups API, tutor names included, credited in the README

- Status: Accepted
- Date: 2026-09-28
- Decided by: Matt
- Source: #4

## Decision

The six classes are seeded from real course data: day, start, end, room and
tutor name as published at
`https://comp.anu.edu.au/courses/comp4020-agentic-coding-studio/api/crit-groups.json`.
The data is copied into a committed seed file; the app never fetches it at
runtime. The project README credits the source.

## Reason

Matt: "For #4, I want to go with option a. Credit the source in the project
README" (the research comment's option 1: real data including tutor names,
with attribution). The research on #4 found the course site is licensed CC
BY-NC-SA 4.0, describes itself as "readable by machine", and says of reuse
"attribution is cheap", suggesting "a plain credit naming the course (ANU
School of Computing) and Ben Swift, with a link to this site". The tutor names
are already public on the course's People and Crits pages.

## Consequences

- The slice that seeds classes adds the credit to `README.md`: the course
  (ANU School of Computing), Ben Swift, a link to the site, the licence, and
  the date the data was copied.
- `crit-groups.json` calls itself provisional until enrolments settle, so the
  seed file can go stale; it records the access date.
- Not resolved by the research and accepted as low risk: `crit-groups.json` is
  not a documented endpoint, and whether ShareAlike reaches a seed file.
