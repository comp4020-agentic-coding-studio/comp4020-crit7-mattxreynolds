# 0025. An offer is pending, accepted, declined, withdrawn or closed, and "Your offers" lists them all, pending first

- Status: Accepted
- Date: 2026-09-28
- Decided by: Matt
- Source: #9

## Decision

An offer has one of five statuses, shown to its offerer as:

| Status | Meaning | Label |
|---|---|---|
| pending | waiting for the poster | "Pending" |
| accepted | the poster accepted it (0024) | "Accepted" |
| declined | the poster declined it | "Declined" |
| withdrawn | the offerer took it back (0022) | "You withdrew" |
| closed | the app ended it, with a stored reason | "Post withdrawn" / "Post swapped with someone else" / "Closed: you swapped" |

**"Your offers"** on the board (0019) lists every offer the student has
made, pending ones first, then the rest newest first. Each links to its post
page.

## Reason

Matt took the recommendations for Q11 and Q12 ("yes"). **Closed** separates
"the app ended this" from "a person answered it", so a student can tell a no
from a post that went away. Storing the reason means the label is read, not
worked out after the fact. Listing pending first puts answers that arrived
since the student last looked at the top. On a demo board the list stays
short.

## Consequences

- Only pending offers count towards the pending-offer count (0023) and lock
  editing (0018).
- Terms fixed in `CONTEXT.md`: offered class; pending, accepted, declined,
  withdrawn and closed (offer); swapped (post).
