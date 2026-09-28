---
name: tdd
description: Test-first loop at an agreed seam — one failing test, the least code to pass it, repeat. Use inside /work when a slice's behaviour is testable at its public boundary (HTTP route on the built server, a pure logic module, a browser flow).
model: sonnet
---

# TDD at the agreed seam

A seam is the public boundary a test sits at. Tests live at seams, never
against internals. The seam comes from the issue (Claude proposes, it is
agreed before the first test); don't invent a new one mid-loop.

## Where tests go

- **HTTP contract** (a route persists, returns, rejects): `spec/<feature>.test.ts`,
  driving the built server with `inject("baseUrl")` like
  `spec/guestbook.test.ts`. It runs against a throwaway database.
- **Pure logic** (e.g. matching rules) kept in a DOM- and db-free module under
  `src/lib/`: a `spec/<feature>.test.ts` importing only that module. Never
  import `src/lib/db.ts` into a test: it opens a database at import.
- **Browser flow** (what a user sees across a reload, both viewports):
  `e2e/<feature>.spec.ts`, run by `pnpm e2e`.

## Loop

1. Write one test for the next behaviour in the acceptance lines. Run it
   (`pnpm test` builds first; `pnpm exec vitest run spec/<file>` after a
   build). Watch it fail for the right reason.
2. Write the least code that passes it. Run it green.
3. Next behaviour. One test, one implementation, per cycle: never a batch of
   tests first (they verify imagined behaviour).
4. Run the whole suite at the end (`pnpm check`).

## Anti-patterns

- **Tautological**: the assertion recomputes the expected value the way the
  code does. Assert a literal, observable outcome.
- **Coupled to internals**: asserting on private functions, SQL strings or
  markup structure the user never sees.
- **Weakening a check** to go green. Protected checks stay as shipped.

Refactoring is not part of the loop; do it after green, in its own commit.
Commit at green with `Refs #N`; a red commit needs its reason in the message.
