# 0008. The example course is COMP4020 and its classes are crit-group sessions

- Status: Accepted
- Date: 2026-09-28
- Decided by: Matt
- Source: #3

## Decision

The app models one course, COMP4020. The classes students swap between are its
crit-group sessions: each has a day, a start and end time, a room and a tutor.

## Reason

Matt: "Use this course - COMP4020 - as the example." COMP4020 has no tutorials;
the crit-group session is the class a student is allocated to. The six
sessions are public on the course API (`/api/crit-groups.json`, checked
2026-09-28): Mon 14:00 and 15:30, Wed 09:00, 10:30, 14:00 and 15:30, all in
Marie Reay Building (155) Room 4.03 by default.

## Consequences

Seed data can come from real, public course data rather than invented slots
(input to #4). Only one course; cross-course moves stay out of scope.
