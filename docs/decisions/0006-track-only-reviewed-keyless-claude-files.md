# 0006. Track only reviewed, keyless .claude files

- Status: Accepted
- Date: 2026-09-28
- Decided by: Matt
- Source: #1

## Decision

`.claude/settings.json`, `.claude/skills/`, `.claude/agents/` and
`.claude/hooks/` are tracked. Everything else under `.claude/`, including
`settings.local.json`, stays ignored. No key, token or personal setting is
committed.

## Reason

The harness is part of what is marked, so it has to be in the repo; the
course key must never be, and the repo goes public at ship.

## Consequences

`.gitignore` allowlists those paths; the starter's pre-commit key guard and
CI's TruffleHog scans remain the backstop.
