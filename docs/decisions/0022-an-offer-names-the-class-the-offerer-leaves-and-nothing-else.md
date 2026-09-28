# 0022. A student offers from a post page by naming one of its join classes, one pending offer per post, and can withdraw it until it is accepted

- Status: Accepted
- Date: 2026-09-28
- Decided by: Matt
- Source: #9

## Decision

- **Who and where:** any logged-in student except the poster can offer on an
  **open** swap post, with an "Offer to swap" control on its post page. The
  board has no offer button. A withdrawn or swapped post shows no offer
  control.
- **What an offer records:** the student who offered, the post, and the
  **offered class**: one of the post's join classes, which the offerer says
  they hold and would leave. It is trusted, like the leaving class (0016), and
  pre-selected when the post has only one join class. An offer carries no
  message; talking happens in comments (#10) and private messages (#11).
- **Limits:** a student has at most one pending offer per post. A post can
  have any number of pending offers, and a student can have pending offers
  on several posts at once. A student whose offer on a post was declined
  cannot offer on that post again; one who withdrew their own offer can.
- **Withdrawing an offer:** the offerer can withdraw a pending offer from the
  post page or from "Your offers" on the board. An accepted offer cannot be
  withdrawn.

## Reason

Matt took every recommendation in #9 ("yes", Q1–Q5). The app stores no
allocations (0016), so only the offerer can say which class they would give
up. Without it, accepting an offer on a post with several join classes would
not say where the poster ends up. Keeping the offer to a class keeps slice 3
small for the 30 Sep cutoff (0009). Several offers per post is the
visibility 0007 argues for. The decline rule stops repeat offers after a no.
Offer withdrawal mirrors the poster's withdraw-any-time rule (0018).

## Consequences

- The schema gains an offers table (post, offerer, offered class, status,
  times) via `pnpm db:generate`.
- The server rejects: an offer on your own post, on a post that isn't open,
  from a class not in the post's join classes, a second pending offer on the
  same post, and a re-offer after a decline.
- Withdrawing the last pending offer unlocks the post for editing (0018).
- Statuses: 0025. Accept, decline and their effects: 0024. Visibility: 0023.
