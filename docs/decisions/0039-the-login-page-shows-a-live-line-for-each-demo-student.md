# 0039. The login page shows, beside each demo student, a live line saying what they have waiting

- Status: Accepted
- Date: 2026-09-28
- Decided by: Matt
- Source: #12

## Decision

Each demo student's button on the login page (0014) carries one line,
worked out from the database when the page loads. For example:

- "alex: 2 offers to answer · 1 unread message"
- "sam: 1 pending offer"
- "noah: no post yet"

It uses only the counts the app already has: pending offers on the
student's open post (0023), their own pending offers (0025), their unread
private messages (0033), and whether they have an open post (0017).

## Reason

Matt took the recommendation for Q3 ("yes"). 0014 lists demo students by
name so a tutor can pick the poster, but a bare name doesn't say who that
is. A line worked out live stays true after someone accepts an offer, where
a fixed description would go stale.

## Consequences

- The login page is the one logged-out page that reads demo students'
  counts. It shows counts only, never post contents, usernames of others or
  message text, so 0013 still holds.
- The line gains parts as slices ship: the post part with the board, offers
  with offers, the unread count with private messages.
