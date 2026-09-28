# 0024. Accepting an offer is final: the post becomes swapped and both students' other pending activity closes; declining and withdrawing a post close offers too

- Status: Accepted
- Date: 2026-09-28
- Decided by: Matt
- Source: #9

## Decision

- **Accept** (poster, on the post page, after a confirm step saying it is
  final): the offer becomes accepted and the post becomes **swapped**. A
  swapped post leaves the board. Its post page still loads and says
  "Swapped: <poster> moves to <offered class>, <offerer> moves to <leaving
  class>. Make the change in MyTimetable. This app can't." There is no undo.
- **What else an accept closes:**
  - the post's other pending offers;
  - every other pending offer made by the poster or by the offerer, on any
    post;
  - the offerer's own open post, if they have one. It becomes withdrawn, its
    page says it was withdrawn automatically because of the swap, and its
    pending offers close.
- **After an accept:** the poster's "Your post" spot shows "Post a swap"
  again, with a line linking to the swapped post until they post again. The
  offerer sees "Accepted" in "Your offers". Both can post again (0017).
- **Decline:** one click, with no reason. The offer shows "Declined" to its
  offerer and the post stays open.
- **Withdrawing a post** (0018): its pending offers close, and each offerer
  sees "Post withdrawn" in "Your offers", linking to the withdrawn post page
  (0020).

## Reason

Matt took the recommendations for Q7–Q10 ("yes"). The app cannot change real
allocations (0007), so an agreed swap has to be a stable record both
students can point to. Each student holds one crit session (0008), and an
accept has just changed it for both of them. Without closing their other
offers, the same class could be promised in two accepted swaps, and "agreed
by both" (0007) would mean nothing. A decline reason would be a message,
which belongs to #10 and #11. Closing offers on a withdrawn post stops them
sitting pending on a post that is gone.

## Consequences

- Post statuses become **open**, **withdrawn** and **swapped**. A post
  records which offer was accepted, and a withdrawn post records whether the
  poster withdrew it or a swap did.
- An accept changes several rows, so it runs in one transaction.
- The swapped post page goes into route coverage alongside the withdrawn one
  (0020).
- Demo seed (#12) needs a pending offer to accept, and an accepted one to
  show the swapped page.
