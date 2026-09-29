# 0056. If time runs short, cut in a fixed order, and there is no hard stop

- Status: Accepted
- Date: 2026-09-29
- Decided by: Matt
- Source: #29 (map #27)

## Decision

Redesign work has no hard stop time. If the C7 cutoff (Wed 2026-09-30 08:30)
gets close, screens drop from a full redesign to shell only in this order, and
the board is never cut:

1. About, the inbox, a conversation, new and edit post, and the accept step;
2. then the post page;
3. then login and signup, last.

## Reason

Matt on Q3: "I like your recommendation" (the post page drops first, then
login, the board never). Matt on Q4: "No hard stop". Matt on Q5, after Q1
made every screen full and the order had to cover the secondary screens too:
"yes" (taking the recommended order above). The order follows how early a
tutor meets each screen: the board decides the three-second read, login is the
first impression, and About and the message screens are reached last.

## Consequences

- With no stop time, the order is the only guard: a screen not finished when
  the cutoff nears ships as shell only, not half redesigned.
- The evidence still has to be in place before the crit (`pnpm check:evidence`
  passes, PROCESS.md and `reflections/crit-7.md` current); this decision sets
  no time for it.
- Terms fixed in `CONTEXT.md`: cut order.
