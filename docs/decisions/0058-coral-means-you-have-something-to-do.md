# 0058. Coral means "you have something to do": pending offers on your own post, unread private messages and form errors

- Status: Accepted
- Date: 2026-09-29
- Decided by: Matt
- Source: #32 (map #27)

## Decision

Coral is the **attention** colour. It marks only a state that is waiting on the
viewer:

- **Pending offers on your own post**, when there is at least one: the
  "N pending offers" count on your pinned "Your post" and on your post page, and
  the poster's Offers heading and list. At 0 the count is neutral.
- **Unread private messages**: the "Messages (N)" count in the header and the
  unread rows in the inbox (`0033`).
- **Form errors** (`role="alert"`) on login, signup, new and edit post and the
  accept step.

Everything else is neutral, told apart by its wording (and a plain badge
shape), never by colour alone:

- your own pending offer, and offers that are accepted, declined, withdrawn or
  closed (`0025`);
- the post statuses open, withdrawn and swapped;
- the pending-offer count on anyone else's post;
- the board's flash notice (`role="status"`), which only confirms something;
- the login page's "N offers to answer" line (`0039`), because nothing is
  waiting on a visitor who has not logged in;
- the buttons Withdraw, Decline and Delete, which take the secondary style.
  Cyan stays the primary (Accept, Offer to swap, Post a swap).

Coral is drawn as a pill around a count and a coral bar on the left edge of an
unread inbox row, with the existing bold kept. The label text is never removed.

## Reason

Matt took all six recommendations ("yes"). Coral stays rare and always answers
"does this need me?": if every status were coral nothing would be, and if a
pending offer on your own post were not, the poster would miss the one thing
they must act on. The board and post page already know whose post it is
(`own`, `isPoster`), so it needs no new data. Keeping Decline off coral stops
the thing you must answer and the button you press sharing a colour.

## Consequences

- No schema, route or behaviour change; this is styling and one conditional
  (own post and N ≥ 1) in `PostEntry` and `PostLive`.
- Exact shades and their contrast ratios stay with the focus and contrast fog
  on map #27, and are Claude's choice inside the build issue.
- Terms fixed in `CONTEXT.md`: attention (coral).
