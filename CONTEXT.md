# Domain glossary

The words this project uses, so issues, code, tests and conversation mean the
same thing. Add a term when a decision fixes its meaning (`/grill` does this);
change one only through a new decision. Code names follow these terms.

## ANU timetabling, as it exists

Checked 2026-09-23 against ANU's timetabling pages; sources in
`docs/c7-brainstorm.md`. Matt's own experience outranks these notes.

- **MyTimetable**: ANU's student timetabling system (Allocate+).
- **Course**: a unit of study with a code, e.g. COMP2100.
- **Activity group**: one kind of class within a course, e.g. "COMP2100
  tutorial". A student is allocated to one activity per group.
- **Activity**: one scheduled class in an activity group, with a day, time and
  room. What a student means by "my tutorial slot".
- **Allocation**: the activity a student currently holds in an activity group.
- **Allocation period**: from two weeks before teaching until three weeks in,
  when students self-allocate and request swaps in MyTimetable.
- **Swap request (MyTimetable)**: a request to move into a full activity in a
  group you are already allocated in; ANU does not document when it is filled.
- **Lock-in**: after the allocation period, changes need the **course contact**
  to agree, for unforeseen circumstances.

## The app: candidate terms, not yet decided

From the brainstorm's recommended slice. Each needs Matt's decision before it
is used in code; `/grill` moves a term up to the section below when it is.

- swap offer, acceptable (target) activity, match, cycle, identity (who is
  posting), offer status.

## The app: decided terms

None yet.

## Harness

- **Decision map**: a `wayfinder:map` issue indexing the decisions between here
  and a destination. **Decision issue**: one of its children; resolved by
  Matt's answer.
- **Fog**: decisions visible ahead that can't yet be asked precisely.
- **Frontier**: the open, unblocked, unclaimed children of one parent
  (`scripts/frontier.sh`). Decisions and build work have separate frontiers.
- **Spec**: a `spec` issue synthesising a cleared map. **Slice**: a vertical
  build child of a spec, UI to route to database and back.
- **Seam**: the public boundary a test sits at, agreed before the first test.
- **Claim**: assigning an issue (and labelling it `in-progress`) before work.
- **Implemented / verified / accepted**: code exists / gates and evidence are
  green and recorded / Matt has accepted and closed the issue.
- **Handoff**: the issue comment ending a session (evidence, state, next
  step), mirrored in `.scratch/handoff.md` for the next SessionStart.
