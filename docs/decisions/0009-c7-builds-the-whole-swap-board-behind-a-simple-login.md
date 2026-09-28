# 0009. C7 builds the whole swap board behind a simple password login, in shippable slices

- Status: Accepted
- Date: 2026-09-28
- Decided by: Matt
- Source: #3

## Decision

C7 targets the whole vision: a simple password login, swap posts on a board,
offers the poster accepts or declines, comments on a post, and private messages
between students. It is built and deployed one slice at a time, in this order,
so each step ships on its own if time runs out:

1. login
2. swap post + board
3. offer → accept/decline
4. comments
5. private messages

## Reason

Matt asked for the whole vision with "a super simple login system". Private
messages are not private without real accounts, so the login is password based
(demo login, not ANU single sign-on). Slices 1–2 already meet spec line 3
(create something, reload, it's still there), so later slices add value without
putting the crit at risk. Offer → accept/decline comes first among the
additions because it is the part that improves on MyTimetable (0007).

## Consequences

Map #2 widens from "a persisted offer" to the whole swap board. #5 changes from
"identity without login" to how the simple login works. New decisions: offers
and accept/decline, comments, private messages. Due date unchanged: 30 Sep.
