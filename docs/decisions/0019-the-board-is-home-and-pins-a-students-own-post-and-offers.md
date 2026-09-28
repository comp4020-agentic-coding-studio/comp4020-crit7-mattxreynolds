# 0019. The board is the home page, and pins a student's own swap post and offers above everyone else's posts

- Status: Accepted
- Date: 2026-09-28
- Decided by: Matt
- Source: #8

## Decision

- The **board** is at `/`. It lists every open swap post, newest first. Each
  entry links to its post page (0020).
- A student's own open post is pinned above the list under **"Your post"**,
  with Edit and Withdraw buttons and a "N pending offers" count linking to
  the post page. With no open post, that spot shows a "Post a swap" button.
- Below it, a **"Your offers"** section lists each post the student has
  offered on, with the offer's status, linking to that post. It appears only
  once they have made an offer.
- After creating a post or saving an edit, the student lands on the board,
  with a short "Your swap post is on the board" / "Changes saved" notice
  above their pinned post.
- There is no separate "my posts" or "my offers" page.

## Reason

Matt accepted every recommendation in #8 ("yes", Q1, Q4–Q6). The product is
about swaps being visible (0007), so a student finds their post where others
see it, and reloading `/` is the spec line-3 check ("create something,
reload, it's still there"). A student has at most one open post (0017), so a
"my posts" page would only ever hold one item. Putting everything that is
the student's on the landing page means a new offer is visible without
hunting for it.

## Consequences

- The board replaces the guestbook at `/`. The guestbook tests retire in the
  login slice (0021).
- The e2e flow for the swap post slice drives `/` at both viewports.
- How offers work, and their statuses, is still #9's call. This record only
  says where they appear.
- Terms fixed in `CONTEXT.md`: board.
