# 0037. There are seven demo students with first-name usernames and one shared password, `demo-student`

- Status: Accepted
- Date: 2026-09-28
- Decided by: Matt
- Source: #12

## Decision

- The seed creates seven **demo students** (0014): `alex`, `priya`, `sam`,
  `lena`, `jordan`, `mei` and `noah`. Each has one role in the demo (0038).
- They share one password, `demo-student`, which the README publishes (0014).

## Reason

Matt took the recommendation for Q1 and Q5 ("yes"). A username is shown on
everything its student creates (0011), so plain first names make the board
read like students talking, where `demo-poster` would read like a test.
Seven students is enough to fill every role in 0038 with no one doubling up.
`demo-student` meets the 8-character minimum (0011) and says what it is.

## Consequences

- The login page lists these seven, one button each, plus "Random demo
  student" (0014). Each button carries a live line (0039).
- These usernames are taken. Signing up as `alex` fails like any other
  duplicate (0011).
