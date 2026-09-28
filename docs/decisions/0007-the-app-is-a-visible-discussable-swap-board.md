# 0007. The app is a swap board that makes swaps visible, discussable and agreed

- Status: Accepted
- Date: 2026-09-28
- Decided by: Matt
- Source: #3

## Decision

The C7 slice improves class swapping in general, not only after lock-in. A
student posts what they are leaving and what they would join, with an optional
message; others can discuss it and say they are happy to swap; the poster
accepts or declines. The README's argument: MyTimetable swaps are blind (you
ask for a class and wait, without seeing who wants yours or being able to talk
to them); this board makes swaps visible, discussable and agreed by both
students. It is a parallel system that cannot change real allocations, and the
README says so.

## Reason

Matt: "Don't worry so much about the after lock-in idea. I just want to improve
the swapping feature all together." MyTimetable already handles swap requests
during the allocation period, but gives no view of who wants what and no way to
talk (ANU timetabling FAQ; `docs/c7-brainstorm.md`).

## Consequences

The post-lock-in matcher from the brainstorm is dropped. Automatic pair and
cycle matching is not part of the vision (#7 may be moot). Words are fixed in
`CONTEXT.md`: swap post, offer, accept, decline, class.
