# 0041. A reset deletes everything involving a demo student, including a real student's post swapped with one, then reseeds

- Status: Accepted
- Date: 2026-09-28
- Decided by: Matt
- Source: #12

## Decision

`pnpm seed:reset` (0040) deletes, then writes the seed again (0038):

- every swap post by a demo student, with its offers and comments, whoever
  made them;
- every offer and comment by a demo student, on any post;
- every private message to or from a demo student;
- any real student's post that was **swapped** through a demo student's
  accepted offer.

Nothing else changes. Real students keep their accounts and everything that
involves only real students.

## Reason

Matt took the recommendation for Q6 ("yes"). Delete-then-reseed is the
simplest reset that returns the demo to exactly 0038. A swapped post names
both students and its accepted offer (0024), so it can't outlive that
offer. Keeping it with the demo student blanked out would leave a hole in
the post. Refusing to reset while a real student is linked could block the
reset before a crit.

## Consequences

- The reset runs in one transaction, like an accept (0024).
- A real student's pending-offer count or conversation list can drop after
  a reset. The README's demo notice (0015) already says demo students are
  shared.
- A test covers the reset: seed, change demo and real rows, reset, then
  check the demo matches 0038 and real-only rows are untouched.
