# 0047. A board entry shows the whole post, with its message cut short

- Status: Accepted
- Date: 2026-09-28
- Decided by: Matt
- Source: #14

## Decision

Each board entry (0019), and the pinned "Your post", shows:

- the poster's username;
- the leaving class and the join classes;
- the first ~120 characters of the message, cut with "…" if longer,
  with nothing shown if the post has no message;
- the posted time, and "edited" if it was edited (0018);
- the pending-offer count and "N comments" (0023, 0028).

The full message is on the post page (0020).

## Reason

Matt took the recommendation ("Full post, message cut"). A student scans the
board for a leaving class they'd join and a join class they hold (0036 has no
matching to do this for them), so both classes have to be on every entry. A
cut message keeps a 390px-wide board scannable, and 0020 already puts the full
message on the post page.

## Consequences

- The board query returns the classes with each post.
