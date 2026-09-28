# 0032. A private message is plain text of up to 500 characters and can't be edited or deleted

- Status: Accepted
- Date: 2026-09-28
- Decided by: Matt
- Source: #11

## Decision

- A private message is plain text, 1–500 characters, shown exactly as
  written (escaped, with line breaks kept). These are the same rules as a
  comment (0026) and a post message (0016).
- Each private message shows its sender's username and when it was sent
  (e.g. "Mon 28 Sep, 14:05").
- A private message can't be edited or deleted.

## Reason

Matt took the recommendation for Q3 ("yes"). Private messages are slice 5,
the last before the 30 Sep cutoff (0009), so this is the smallest version.
A note only the other student sees is less likely to need taking back than a
public comment (0027).

## Consequences

- The server rejects an empty private message and one over 500 characters.
- There are no edit or delete routes for private messages.
