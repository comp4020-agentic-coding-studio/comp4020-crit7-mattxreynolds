# Decision records

One decision per file, named `NNNN-short-slug.md`, numbered in the order made.
A record holds what was decided, by whom, and why, and links where the
discussion happened (usually a closed `wayfinder:*` issue). It is written when
the decision is made, never back-filled from memory.

Records are not edited to change a decision. A reversal is a new record that
names the one it supersedes, and the old one's status line changes to
`Superseded by NNNN`.

```markdown
# NNNN. Title as a statement of the decision

- Status: Accepted | Superseded by NNNN
- Date: YYYY-MM-DD
- Decided by: Matt | Claude (implementation choice within an agreed issue)
- Source: #issue, commit, or brief link

## Decision

## Reason

## Consequences
```

Product behaviour is only ever `Decided by: Matt`. Claude records its own
implementation choices here only when a later reader would otherwise ask
"why this way?".
