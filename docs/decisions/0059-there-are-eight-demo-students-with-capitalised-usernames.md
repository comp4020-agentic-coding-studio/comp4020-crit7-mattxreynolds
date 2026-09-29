# 0059. There are eight demo students with capitalised usernames

- Status: Accepted
- Date: 2026-09-30
- Decided by: Matt
- Source: #44

## Decision

- The seed creates eight **demo students** (0014): `Alex`, `Priya`, `Sam`,
  `Lena`, `Jordan`, `Mei`, `Noah` and `Zara`. `Zara` is clean like `Noah`:
  no post, offers, comments or private messages (0038).
- Their usernames are stored and shown capitalised. Login and sign-up stay
  case-insensitive (0011), so `alex` still logs in as `Alex` and `zara` is
  taken.
- The password is still `demo-student` (0037).
- The operator's reset (0041) renames an existing lowercase demo account in
  place, keeping its id, so nothing that refers to it is lost. A boot still
  writes nothing when a demo student exists, matched ignoring case (0040).

## Reason

Matt chose the recommendations for Zara's role and for changing the stored
usernames over capitalising only on display. A second clean student lets two
testers try posting and offering at once. Renaming in place is what lets the
reset bring the deployed lowercase accounts across without a new set of ids.

## Consequences

- Supersedes 0037, which named seven lowercase students.
- The login page lists eight demo buttons plus "Random demo student".
- On a volume seeded before this, the accounts stay lowercase until the
  operator's reset runs (a boot writes nothing, 0040). The login page's live
  lines still find them, ignoring case, but `Zara` does not exist yet, so her
  button does nothing until the reset. Deploying this needs the reset as its
  next step.
