# 0038. The seed holds three open posts, one swapped post, pending offers to answer, comments and private messages, dated over the last three days

- Status: Accepted
- Date: 2026-09-28
- Decided by: Matt
- Source: #12

## Decision

Classes are named here by day and start time (0010).

| Student | Seeded state |
|---|---|
| **alex** | Open post: leaving Mon 14:00, joining Wed 09:00 or Wed 10:30, message "Clashes with my lab." Two **pending** offers: priya (offered class Wed 09:00) and sam (Wed 10:30). Two comments: sam asks a question and alex replies (tagged "poster", 0026). One **unread** private message from priya to alex. |
| **priya** | Open post: leaving Wed 09:00, joining Mon 14:00 or Mon 15:30. One pending offer, from lena (Mon 15:30). Her own pending offer on alex's post. |
| **sam** | No post. A pending offer on alex's post. |
| **lena** | Open post: leaving Mon 15:30, joining Wed 14:00 or Wed 15:30. No offers. A pending offer on priya's post. |
| **jordan** | **Swapped** post: leaving Wed 14:00, joining Wed 15:30. Accepted offer from mei (Wed 15:30). One comment from mei, dated before the swap. |
| **mei** | The accepted offer on jordan's post. A conversation with jordan dated after the swap, two private messages, both read. |
| **noah** | Nothing: no post, offers, comments or private messages. |

- Every seeded offer's offered class is the offerer's own leaving class
  where they have a post, so the seed never contradicts itself.
- The seed obeys 0017 (one open post each, never joining the leaving class)
  and 0024 (jordan and mei have nothing pending, and no student has two
  accepted swaps).
- **Times** are set relative to when the seed runs, spread over the
  previous three days, in an order that makes sense: each post before its
  offers and comments, jordan's comment before the swap, and the
  jordan/mei conversation after it (0026).

## Reason

Matt took the recommendation for Q2 and Q5 ("yes"). A tutor can log in as
alex and accept or decline without making anything first (0014, 0024).
Accepting priya's offer withdraws priya's post and closes the offers from
sam and lena, so the 0024 cascade shows in one click. Priya's pending offer
from lena is a second post to answer if alex's is used up. The swapped post
shows where an accept leads, and its after-swap conversation shows why
private messages outlive comments (0026). noah is the clean student for
"Post a swap" and making an offer. Relative times stop the board showing
old posts.

## Consequences

- The board opens with 3 open posts: pending-offer counts 2, 1 and 0, and
  comment counts 2, 0 and 0 (0023, 0028).
- The seed is built up slice by slice (0009). Each slice seeds the rows its
  feature adds, so the seed matches whatever is deployed.
- No declined offer or poster-withdrawn post is seeded. Those states come
  from using the app, and tests set them up themselves.
