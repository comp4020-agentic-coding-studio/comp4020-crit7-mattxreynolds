# 0018. A swap post is editable while it has no pending offers, and the poster can withdraw it at any time

- Status: Accepted
- Date: 2026-09-28
- Decided by: Matt
- Source: #6

## Decision

- **Edit:** the poster can change the leaving class, join classes and message
  while the post has no pending offers (offers not yet accepted or declined).
  Declined offers do not lock the post. The same rules as a new post apply
  (0016, 0017). An edited post shows an "edited" marker with the time.
- **Withdraw:** the poster can withdraw their post at any time, including
  after offers arrive. A withdrawn post leaves the board, and the student can
  then post again.

## Reason

Matt on Q5: "Editable while it has no offers". He accepted the follow-up
recommendations for Q9–Q11 ("yes"). Locking the post while an offer is
pending means no one who offered finds the terms changed under them. After
that, withdrawing is how a student changes their mind, given the one-post
limit (0017). Comments (#10) can arrive before any offer, so the "edited"
marker tells readers the post may have changed since a comment was written.

## Consequences

- A post has a status of at least open or withdrawn. #9 adds what accepting
  does to it, and what withdrawing does to its pending offers.
- The post records when it was last edited.
