# 0036. C7 has no automatic matching: students find swaps on the board and agree them by offer

- Status: Accepted
- Date: 2026-09-28
- Decided by: Matt
- Source: #7

## Decision

- C7 does no automatic matching: no direct-pair matching, no cycles, and no
  "fits your post" hint. Students find a swap by reading the board (0019) and
  agree it with an offer the poster accepts (0022, 0024).
- Pair and cycle matching are out of scope for the C7 map. They are later
  work, not a later C7 slice.
- The planned `prototype/matching-depth` prototype is not built.

## Reason

Matt chose "None in C7" over a read-only pair hint, building the prototype
first, and cycles. 0007 had already dropped automatic matching from the
vision. Since #9, only two students ever agree a swap: an offer names one of
the post's join classes and the poster accepts it (0022), and accepting is
final and closes everything else in flight (0024). A cycle needs three
students to agree one swap, which that model can't express without reopening
#9. The cutoff is 30 Sep (0009) and none of the five slices is built yet.

## Consequences

- The spec lists matching (pairs and cycles) under its exclusions, and
  `/slice` makes no matching slice.
- The board and post pages show no match or fit indicator.
- The candidate terms *match* and *cycle* leave `CONTEXT.md` unused. A later
  matching decision would fix them afresh.
