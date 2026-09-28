# 0040. The seed applies only when a demo student is missing, never on every boot, and only the operator can reset it

- Status: Accepted
- Date: 2026-09-28
- Decided by: Matt
- Source: #12

## Decision

- The demo seed (0037, 0038) is written when the database has no demo
  students: a fresh deployed volume, a fresh local database, or a test
  run's throwaway database. Otherwise it is left alone.
- It is never reapplied just because the server booted.
- `pnpm seed:reset` restores the demo students to the seed (0041). Only the
  operator runs it, e.g. `fly ssh console -C "pnpm seed:reset"` before a
  crit. The app has no reset button.

## Reason

Matt took the recommendation for Q4 ("yes"). `fly.toml` auto-stops the
machine and starts it on the next request, so reseeding on boot would wipe
demo activity at random times and break spec line 3 ("create something, and
it's still there"). The marker visit and the automated sweep use the same
database before the crit, and a pod of four or five may use the app at
once, so the demo's pending offers can be used up. Only the operator can put
them back, because a public button would let one visitor wipe another's demo
mid-session.

## Consequences

- The seed runs after migrations at boot and checks first. It never changes
  `migrate()` or committed migrations (CLAUDE.md).
- Spec tests and e2e runs start from the seed, because their databases are
  fresh.
