# 0023. Everyone sees how many pending offers a post has; only the poster sees who offered, and each offerer sees their own offer

- Status: Accepted
- Date: 2026-09-28
- Decided by: Matt
- Source: #9

## Decision

- Every logged-in student sees a post's **pending-offer count**, on its board
  entry and on its post page.
- Only the **poster** sees the offers themselves on the post page: who
  offered, from which class, and the Accept and Decline controls.
- An **offerer** sees their own offer and its status on that post page (with
  Withdraw while it is pending) and in "Your offers" on the board (0019).
- No one else sees who offered.

## Reason

Matt took the recommendation for Q6 ("yes"). The count shows demand, which
is the visibility 0007 is about. Who offered is between the two students,
and 0020 already puts the offer list in the poster's view of the post page.

## Consequences

- The post page renders three ways for an open post: poster, a student who
  has an offer on it, and anyone else. Tests cover each one.
- The count on the board is the same number as the pinned "N pending offers"
  (0019), shown on every entry.
