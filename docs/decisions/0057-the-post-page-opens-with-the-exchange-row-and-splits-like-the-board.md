# 0057. The post page opens with the exchange row and splits like the board

- Status: Accepted
- Date: 2026-09-29
- Decided by: Matt
- Source: #31 (map #27)

## Decision

- **Header.** The post page (`0020`) keeps its heading "Swap post by
  <username>" and opens with the same GIVING → LOOKING FOR exchange row as a
  board entry, enlarged: the leaving class as GIVING, the join classes as
  LOOKING FOR. Beneath it are the status (open, withdrawn or swapped), the
  whole message, the posted and edited times and the pending-offer count.
  This replaces today's Poster / Leaving / Would join / Message list.
- **Wide screen.** The page is a split like the board (`0054`). The side
  column, on the same side as the board's, holds the actions: the poster's
  Offers with Accept and Decline, "Your offer", the offer form, and Edit and
  Withdraw. The main column holds the comment thread and the comment box.
- **Narrow screen (390px).** The columns stack in this order: header, then the
  actions, then the comments, then the comment box. Nothing scrolls sideways.
- **Each pending offer** in the poster's Offers list is one compact row: the
  offerer's username and Message link, "would leave <class>", then Accept
  (primary) and Decline (secondary). On a wide screen they share one line; at
  390px the buttons wrap onto their own line at full tap size. The wording is
  today's, so no new vocabulary.
- Withdrawn and swapped posts still load read-only (`0020`, `0024`), with the
  status sitting in the header; the action controls that no longer apply
  disappear as they do now (`0044`).

## Reason

Matt took all four recommendations ("yes"). A post read one way on the board
and another on its own page would look like two products, and the row is what
gives the three-second read. Putting the actions before the thread on a phone
means the poster reaches Accept and Decline without scrolling past every
comment.

## Consequences

- The grid sits on a wrapper around both the refetched region and the comment
  box, so the comment box stays outside the region the live refresh swaps and
  half-typed text survives (`0044`). How the wrapper is built is Claude's
  choice inside the build issue.
- Tests that pin the page must keep passing: the heading text, the details
  coming before `#comments`, and the `.offer-count` and `.message` selectors.
  The header's markup keeps those.
- Which offer statuses and unread messages get coral is not settled here; it
  is #32 under map #27.
- Terms fixed in `CONTEXT.md`: exchange row; side column now also covers the
  post page.
