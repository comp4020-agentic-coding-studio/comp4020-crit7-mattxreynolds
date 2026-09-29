# 0052. Every page carries an "Unofficial, student-built COMP4020 demo" footer

- Status: Accepted
- Date: 2026-09-29
- Decided by: Matt
- Source: #30 (map #27)

## Decision

A footer on every page, logged in or out, says: "Unofficial, student-built
COMP4020 demo. Not an ANU system: it can't change your real class
allocation." 0015's demo-login notice stays where it is, on the sign-up form
and in the README, unchanged.

## Reason

Matt on Q3: "yes" (taking the recommendation). The second sentence is real
behaviour the README already states (0007); the footer makes it visible on
every screen without repeating 0015's fuller notice.

## Consequences

- The shared layout renders the footer; `Layout.astro` has none today.
- The footer wording is fixed text, like 0015's notice, so a later slice may
  pin it with a spec test.
