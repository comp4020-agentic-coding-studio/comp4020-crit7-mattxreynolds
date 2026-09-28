# 0049. The seed reset runs on Fly from a script built into `dist/`

- Status: Accepted
- Date: 2026-09-28
- Decided by: Matt
- Source: #15 (slicing)

## Decision

- The build bundles the reset into `dist/` alongside the server. On Fly the
  operator runs `fly ssh console -C "node dist/seed-reset.mjs"`.
- Locally it stays `pnpm seed:reset`, which runs the same code.

## Reason

Matt took the recommendation ("accept all the recommendations"). The runtime
image keeps only `dist/`, `drizzle/` and `node_modules`, with no
`package.json`, so 0040's example `pnpm seed:reset` can't run there, and the
Dockerfile is guarded.

## Consequences

- This refines 0040's example command. It doesn't change who may reset
  (the operator only) or what a reset deletes (0041).
- The README's operator note gives the Fly command.
