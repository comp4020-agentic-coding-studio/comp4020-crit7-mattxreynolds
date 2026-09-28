# 0045. Every form action returns to the page it was submitted from, except creating or editing a post

- Status: Accepted
- Date: 2026-09-28
- Decided by: Matt
- Source: #14

## Decision

- After any form action, the student is sent back with a 303 redirect to
  the page the form was on. This covers withdrawing a post, making or
  withdrawing an offer, accepting, declining, deleting a comment, adding a
  comment (0029), and sending a private message (0034).
- There are two exceptions, both from 0019: creating a post and saving an
  edit land on the board with a notice.

## Reason

Matt took the recommendation ("Back to same page"). 0029 and 0034 already
send comments and private messages back where they came from, and a student
who acts on a post page wants to see the result there. For example, after
accepting, the poster sees the "Swapped" text right away (0024). One rule
means no slice has to choose its own.

## Consequences

- Withdrawing an offer from "Your offers" returns to the board. Withdrawing
  it from the post page returns to the post page.
- Everything works with no JavaScript, as 0042 requires.
