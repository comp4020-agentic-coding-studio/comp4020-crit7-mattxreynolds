# 0016. A swap post records one leaving class, one or more join classes, an optional message and when it was posted

- Status: Accepted
- Date: 2026-09-28
- Decided by: Matt
- Source: #6

## Decision

A swap post records:

- the student who posted it;
- its **leaving class**: one class, picked by the student on each post. The
  app trusts that choice and never stores a student's allocation;
- its **join classes**: one or more of the other classes, picked with
  checkboxes;
- an optional message: plain text, at most 500 characters, shown exactly as
  written (escaped, with line breaks kept);
- when it was posted, which the board shows (e.g. "Mon 28 Sep, 14:05").

## Reason

Matt accepted the recommendations for Q1, Q2 and Q6–Q8 ("I like your
recommendation"). His own description says "what they're leaving and what
they're happy to join", and every extra join class means more students can
offer. A student record holds only a username and a password hash (0011), and
the app cannot see real allocations (0007), so the leaving class comes from
the post itself. The posted time helps students ignore stale posts.

## Consequences

- The schema gains a swap posts table and a post↔class join-classes table
  (via `pnpm db:generate`).
- Terms fixed in `CONTEXT.md`: leaving class, join classes. They replace the
  candidate "acceptable (target) activity".
- Validation rules: 0017. Editing and withdrawing: 0018.
