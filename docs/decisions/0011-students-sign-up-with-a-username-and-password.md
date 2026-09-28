# 0011. Students sign up with a username and password, and only those are stored

- Status: Accepted
- Date: 2026-09-28
- Decided by: Matt
- Source: #5

## Decision

Anyone can sign up as a **student** with a username and a password; seeded
demo students exist alongside (0014). A student record holds the username and
a password hash, nothing else: no email, real-name field or uni ID. The
username is the name shown on everything the student creates.

- Usernames: unique ignoring case, 3–20 characters from letters, digits, `-`
  and `_`. A username shaped like a uni ID is allowed.
- Passwords: at least 8 characters, no composition rules.

## Reason

Matt accepted the recommendations (Q1, Q2) and on Q3: "I like your
recommendation but allow uni IDs". Open sign-up lets a tutor at the crit be
themselves; with no password reset or email verification (map #2 out of
scope) an email address would do nothing. Length-only password rules follow
current NIST guidance.

## Consequences

The first schema change adds a students table (via `pnpm db:generate`).
Hashing uses Node's built-in `crypto.scrypt`; no new dependency.
