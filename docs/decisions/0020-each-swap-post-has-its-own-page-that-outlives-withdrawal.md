# 0020. Each swap post has its own page, where its poster sees offers, and the page still loads after withdrawal

- Status: Accepted
- Date: 2026-09-28
- Decided by: Matt
- Source: #8

## Decision

- Each swap post has a **post page** at `/posts/<id>/`. It shows the whole
  post: the poster, leaving class, join classes, full message, and posted
  and edited times.
- The poster sees the offers on their post on its post page, where #9's
  accept/decline controls will go.
- A withdrawn post's page still loads. It shows "This swap post was
  withdrawn" with the time and the post's details, and no edit or offer
  controls. An id that never existed gives a 404.
- The board keeps no history of a student's withdrawn posts.

## Reason

Matt accepted every recommendation in #8 ("yes", Q2, Q5, Q7). A shared link
to a swap post (0013) and the "you already have an open post" link (0017)
need a target, and offers (#9) and comments (#10) need somewhere to live.
Keeping withdrawn pages alive means links in comments, messages and shared
URLs don't break, while the post still leaves the board (0018).

## Consequences

- `/posts/<id>/` goes into `spec/routes.ts` coverage when built (with a
  seeded post, since routes are fetched as a list).
- Whether other students see a post's offers is #9's call. Where comments
  appear on this page is #10's.
- Terms fixed in `CONTEXT.md`: post page.
