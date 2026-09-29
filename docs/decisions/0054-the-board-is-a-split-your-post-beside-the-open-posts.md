# 0054. The board is a split: your post and your offers beside the open posts

- Status: Accepted
- Date: 2026-09-29
- Decided by: Matt
- Source: #28 (map #27)

## Decision

On a wide screen the board (`0019`) is two columns. The side column holds
"Your post" (with Edit and Withdraw, or "Post a swap") and, once the student
has made an offer, "Your offers". Beside it the main column holds "Open
posts". On a narrow screen (390px) the columns stack: "Your post", "Your
offers", then "Open posts". Nothing scrolls sideways.

Both columns are still one `BoardContent` render, so the live refetch
(`0042`) swaps in the same single fragment as before.

## Reason

Matt, shown three structures on the real seed board (dense rows that become
cards, cards at every width, and this split): "I like 3 (the split)." He chose
it over the recommendation (dense rows). He gave no further reason, so none is
recorded.

## Consequences

- The prototype (branch `prototype/board-structure`, never merged) showed the
  open posts as one row each in the main column, GIVING → LOOKING FOR on a
  line with the message cut (`0047`) and the counts beneath. That is what Matt
  saw, not a separate decision; how the shared `PostEntry` is built is
  Claude's choice inside the build issue.
- The issue's worry that a split "splits the live-refetch region" does not
  hold: a grid inside one fragment is still one fragment.
- Still open (map #27 fog): the post-page layout, how coral marks offer
  statuses and unread messages, and the focus and contrast rules.
- Terms fixed in `CONTEXT.md`: side column.
