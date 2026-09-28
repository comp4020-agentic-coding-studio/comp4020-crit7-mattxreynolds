# 0035. The README says who can read private messages, including whoever runs the site

- Status: Accepted
- Date: 2026-09-28
- Decided by: Matt
- Source: #11

## Decision

The README's demo-login notice (0015) gains this sentence: "Private messages
can be read only by the two students in the conversation, which for a demo
student means anyone. They are stored unencrypted, and whoever runs the site
can read them."

There is no block or report feature.

## Reason

Matt took the recommendation for Q6 ("yes"). 0015 already warns that demo
students are shared. What a student can't guess is that the site's operator
can read the database, since "private" suggests otherwise.

## Consequences

The private messages slice adds this sentence to `README.md` (served whole at
`/readme/`). The sign-up form note (0015) stays as it is.
