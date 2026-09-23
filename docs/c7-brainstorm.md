# C7 brainstorm: which ANU system to rebuild

Working notes from an initial brainstorming session. Nothing here is decided.

## What the spec pushes toward

- **A system I actually deal with.** Spec line 2 says "you actually deal with", so the pick must come from my own use, not a guess.
- **A core flow that creates something.** Spec line 3 needs something I create that survives a reload, so the slice needs a clear "create" action.
- **A real schema.** The week is about schemas, SQLite and migrations, so a slice with interesting data and constraints shows more than a single table.
- **Small enough for a week.** Model the part that hurts, not the whole system.

Claims below about how each ANU system behaves are from general knowledge. Check each against my own experience before committing.

## Candidates

### 1. Degree planner (Programs and Courses plus ISIS)

- **Slice:** choose one program, place courses into future semesters, and see which requirements are met or still open.
- **Why it needs a rebuild:** program rules are published as prose on Programs and Courses, and ISIS doesn't show a forward plan against them. Students end up planning in spreadsheets.
- **Core flow that persists:** a saved plan of courses per semester.
- **Schema interest:** programs, requirements, courses, prerequisites and plan entries, with real relationships.
- **Risk:** encoding requirement rules is where the time goes. Limit it to one program, such as my own degree, and a few rule types like unit totals and level limits.

### 2. Tutorial swap board (MyTimetable)

- **Slice:** post an offer to swap your allocated tutorial for another slot, see matching offers, and accept a swap.
- **Why it needs a rebuild:** first guess was "no swap matching exists", but MyTimetable already has swap and waitlist requests. See the deep dive below for the gaps that remain.
- **Core flow that persists:** swap offers and their status.
- **Schema interest:** courses, class slots, allocations and offers, with a state machine from open to matched to done.
- **Bonus:** the starter's live event stream fits a board that updates as others post offers.
- **Risk:** needs a notion of "who am I" without real authentication. A simple name picker or seeded users would do.

### 3. Study room finder (library room booking)

- **Slice:** ask "which room is free at 2pm for four people, anywhere", book it, and see my bookings.
- **Why it needs a rebuild:** booking grids are usually per building, so finding any free room means clicking through several.
- **Core flow that persists:** a booking.
- **Schema interest:** buildings, rooms, capacities and bookings, plus a constraint that stops double booking.
- **Risk:** low. It might feel thin unless the search is genuinely better than the original.

### 4. Assessment deadline and grade tracker (Wattle and class summaries)

- **Slice:** one calendar of every assessment across my courses, with weights, and a "what do I need on the final" calculator.
- **Why it needs a rebuild:** each course lays out assessment differently across its class summary and Wattle page, so there is no single view.
- **Core flow that persists:** assessments and the marks I record for them.
- **Schema interest:** courses, assessment items, weights, due dates and results.
- **Risk:** low, and very buildable. Less obviously "an ANU system" than the others, so the README must argue the link.

### 5. Extension and special consideration tracker

- **Slice:** submit an extension request with dates and a reason, then track its status. A convenor view approves or declines it.
- **Why it needs a rebuild:** requests often go through forms and email, with no single place to see status.
- **Core flow that persists:** a request with a status history.
- **Schema interest:** requests, status transitions and an audit trail.
- **Risk:** two roles means faking roles. The process varies by college, so pick the one I know.

### 6. "What can I take next semester" (Class Search)

- **Slice:** enter the courses I've completed, and list the courses offered next semester whose prerequisites I meet.
- **Why it needs a rebuild:** prerequisites are prose on each course page, so checking eligibility means opening courses one by one.
- **Core flow that persists:** my completed-course record.
- **Risk:** overlaps with the degree planner. It could be that planner's first milestone.

## Early leaning

The degree planner and the swap board have the richest schemas and the clearest pain. The deadline tracker is the safest to finish in a week. The final pick should be whichever one I have actually been annoyed by.

## Open questions

- Which of these have I actually used this year?
- Is there real data I can seed from, such as public course pages, without scraping anything I shouldn't?
- How do I show "who am I" without building authentication?

## Deep dive: tutorial swap board and "what can I take next semester"

### What ANU already does (checked 2026-09-23)

- **MyTimetable is Allocate+.** Students self-allocate to tutorials during an allocation period that runs from two weeks before teaching until three weeks in.
- **Swaps already exist.** You can request a swap into a full activity if you are already allocated in that activity group. Requests are marked with a heart icon, and outcomes arrive as alerts under a bell icon.
- **Waitlists exist for unallocated students.** They cover students who can't fit any class with space, for example because of a clash.
- **When a pending swap is filled is not documented by ANU.** Other universities running the same system say a pending swap goes through when a place frees up or when another student wants your spot.
- **After the allocation period you are locked in.** Changes then need the course contact to agree, for "unforeseen circumstances".
- **Course requisites are prose.** COMP2100 reads "COMP1110 or COMP1140 AND 6 units of 1000-level MATH", plus a program-specific extra condition and an incompatibility with COMP6442.
- **Future offerings are "indicative only".** Pages group offerings by year and by semester.
- **There is no official data API for Programs and Courses.** The unofficial `smcclab/anu-pandc` command-line tool from the ANU School of Computing exports courses and programs as JSON.

Sources:
- ANU timetabling FAQ: https://www.anu.edu.au/students/program-administration/timetabling/05-frequently-asked-questions
- ANU MyTimetable access and support: https://www.anu.edu.au/students/program-administration/timetabling/01-access-and-support-for-mytimetable
- UTS on swaps in the same system: https://www.uts.edu.au/for-students/current-students/managing-your-course/using-uts-systems/student-forms-apps-and-systems/my-timetable/mytimetable-swaps-waitlists-and-deallocations
- COMP2100 course page: https://programsandcourses.anu.edu.au/course/COMP2100
- anu-pandc: https://github.com/smcclab/anu-pandc

### Tutorial swap board, revised

A plain "post a swap offer" board would duplicate what MyTimetable already does. These are the gaps that might remain. Each needs checking against my own experience.

- **After lock-in.** Once week three passes, a swap means emailing the course contact. Nothing helps two students find each other first.
- **Linked moves.** Moving one tutorial can clash with another course's activity. MyTimetable handles one activity group at a time, so rearranging two courses means doing them in order and risking the first spot.
- **Cycles.** A three-way swap happens when A wants B's slot, B wants C's and C wants A's. Pairwise matching can't find it, and it isn't clear whether Allocate+ can.
- **Visibility.** You can't see demand, such as how many people want out of Friday 5pm, or why a pending swap hasn't moved.

**Recommended slice:** a post-lock-in swap matcher for one course.

- A student records their current tutorial and ticks every slot they would accept.
- The app finds direct pairs and short cycles among open offers.
- A match produces a ready-to-send request naming every student and slot, so the course contact approves one tidy change instead of untangling emails.
- The board updates live through the starter's event stream as offers arrive.

**Schema sketch:**

- `courses`, then `activity_groups` such as "COMP2100 tutorial", then `activities` holding day, time and room.
- `students`, seeded demo identities picked from a dropdown, with no real login.
- `allocations`, one per student per activity group.
- `swap_offers` naming a student and the activity they hold, with a status of open, matched, withdrawn or done.
- `offer_targets`, the many-to-many list of acceptable activities.
- `matches` and `match_members`, grouping the offers in one pair or cycle.

**Core flow that persists:** post an offer, reload, and it's still there. Accept a match, reload, and the status holds.

**Mechanically checkable spec tests:**

- An offer survives a reload.
- Two complementary offers produce exactly one match.
- A withdrawn offer never appears in a match.
- A three-cycle is found.

**Risks:**

- **Cold start.** An empty board demos badly, so seed realistic offers.
- **It's a parallel system.** It can't change real allocations, and the README must say so honestly.
- **Weak premise if lock-in swaps are rare in my courses.** Check before committing.

### "What can I take next semester", deeper

**The pain:** eligibility for a course means reading prose requisites one page at a time. They mix AND and OR, unit counts at a level ("6 units of 1000-level MATH"), program-specific extras and incompatibilities.

**Recommended slice:** eligibility for one subject area, such as COMP and MATH courses from 1000 to 3000 level, next semester only.

- I record my completed courses and the ones in progress.
- The app sorts next semester's offerings into four groups.
  - **Eligible now.**
  - **Eligible if in-progress courses pass.**
  - **Blocked,** with the exact missing piece, for example "needs COMP1110 or COMP1140".
  - **Incompatible,** with the reason.
- Program-specific conditions apply once I set my program.

**The interesting part is the schema.** Requisites stored as an expression tree make the week's "schema as ground truth" point concrete.

- `courses` holding code, title, units and level.
- `offerings` holding course, year and session, marked indicative when the page says so.
- `requisite_nodes` holding id, course, parent and kind. Kind is one of and, or, course, or units-at-level, with parameters for the last two.
- `incompatibilities` holding pairs of courses.
- `programs`, plus a link from a requisite node to a program for program-specific conditions.
- `students`, and `student_courses` holding course, session and a status of completed or in progress.

**Where the data comes from:**

- Export course JSON once with `anu-pandc`, then commit a seed file so the app never scrapes at runtime.
- Convert the prose requisites with a small parser for the common shapes. Hand-encode the rest.
- Flag anything unparsed as "check the course page" rather than guessing. Honesty about coverage is part of what good looks like.
- Check the Programs and Courses terms of use before seeding from the site.

**Core flow that persists:** add completed courses, reload, and both the record and the eligibility results are still there.

**Mechanically checkable spec tests:**

- A completed-course record survives a reload.
- COMP2100 shows as blocked without COMP1110 and as eligible with COMP1110 plus 6 units of 1000-level MATH.
- An incompatible course never shows as eligible.
- An in-progress requisite yields "eligible if you pass".

**Risks:**

- **Parsing prose requisites.** It can eat the week, so cap coverage to one subject area and hand-encode the odd ones.
- **Indicative offerings.** Future offerings can change, so the app must label them as indicative.
- **Program-specific conditions.** These multiply the cases, so support only my own program at first.

### A possible hybrid

"What can I take next semester, and does it fit my timetable" joins both ideas, but it is probably too much for one week. Keep it as a stretch goal or a final-project seed.

### Comparison

| | Swap matcher | Eligibility checker |
|---|---|---|
| Real pain, verified | partly: basic swaps already exist | yes: requisites really are prose |
| Schema depth | good: offers, targets, matches | high: requisite expression tree |
| Uses starter's live stream | yes, naturally | no |
| Seed data | invented demo students | real course data via anu-pandc |
| Biggest risk | premise may be weak | parsing effort |
| Demo appeal | live matching | "why can't I take this" explanations |
