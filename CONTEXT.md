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

- match, cycle, status of an offer. ("Acceptable (target) activity" was
  replaced by *join classes*, below.)
  ("Identity" was replaced by *student*, below.) ("Swap offer" was replaced by *swap post* and *offer*, below.)

## The app: decided terms

Fixed by #3 (`docs/decisions/0007`, `0008`) unless noted.

- **Class**: in this app, one COMP4020 crit-group session (day, start, end,
  room, tutor). The app's instance of an *activity*.
- **Swap post**: what a student creates: its leaving class, its join
  classes, an optional message, and when it was posted (`0016`).
- **Leaving class**: the one class a swap post says its student is leaving.
  Picked on each post; the app never stores a student's allocation. Fixed by
  #6 (`docs/decisions/0016`).
- **Join classes**: the one or more other classes a swap post says its student
  would join. Never includes the leaving class. Fixed by #6 (`0016`, `0017`).
- **Open / withdrawn** (swap post): an open post is on the board; a withdrawn
  one was taken down by its poster. Further statuses come from #9. Fixed by
  #6 (`0018`).
- **Board**: the page at `/` listing every open swap post, newest first,
  with the student's own post pinned under "Your post" and the offers
  they've made under "Your offers". Fixed by #8 (`docs/decisions/0019`).
- **Post page**: one swap post's own page, `/posts/<id>/`, where its poster
  sees offers. It still loads after the post is withdrawn. Fixed by #8
  (`0020`).
- **Offer**: another student saying "happy to swap" on a swap post. Never
  used for the post itself.
- **Accept / decline**: the poster's answer to an offer.
- **Student**: an account in this app: a username and a password (hash).
  The username is the name shown on what they create. Fixed by #5
  (`docs/decisions/0011`).
- **Demo student**: a seeded student whose password is shared and published,
  reachable from the login page in one click. Fixed by #5 (`0014`).

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
