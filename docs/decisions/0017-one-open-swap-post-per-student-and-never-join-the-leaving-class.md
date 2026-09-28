# 0017. A student has at most one open swap post, and a post never lists its leaving class as a join class

- Status: Accepted
- Date: 2026-09-28
- Decided by: Matt
- Source: #6

## Decision

- A post's join classes never include its leaving class. The form doesn't
  offer it, and the server rejects it with a message if sent anyway.
- A student has at most one open swap post. Trying to create a second shows
  "you already have an open post" with a link to it.

## Reason

Matt accepted the recommendations for Q3 and Q4. Moving into the class you
already hold is not a swap. A COMP4020 student holds exactly one crit session
(0008), so a second open post could only repeat or contradict the first.

## Consequences

These settle the "swap post validation rules" fog on map #2. Both rules also
apply when a post is edited (0018). To post differently, a student edits
their post or withdraws it.
