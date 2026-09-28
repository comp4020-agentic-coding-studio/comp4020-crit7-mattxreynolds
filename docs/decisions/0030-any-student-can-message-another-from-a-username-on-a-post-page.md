# 0030. Any logged-in student can send a private message to any other student, starting from a username on a post page

- Status: Accepted
- Date: 2026-09-28
- Decided by: Matt
- Source: #11

## Decision

- **Who:** any logged-in student can send a private message to any other
  student. Nobody can message themselves.
- **Where it starts:** a "Message" link beside a username on a post page
  (0020): the poster, each commenter (0026), and each offerer in the
  poster's view (0023). A swapped post's page names both students (0024), so
  either can message the other after a swap.
- There is no free-text "To:" field and no check that two students are
  linked by a post, offer or comment.

## Reason

Matt took the recommendation for Q1 ("yes"). An offer carries no message
(0022), so the poster needs a way to ask an offerer something. Comments go
read-only once a post is withdrawn or swapped (0026), so the two students in
a swap need somewhere to arrange the MyTimetable change (0024). Starting from
a name on a post page keeps messaging tied to swaps, and without a "linked"
check there is no rule that could stop them talking at the wrong moment.

## Consequences

- The server rejects a private message to yourself, to a username that
  doesn't exist, and from a logged-out visitor.
- The post page renders "Message" links next to usernames, never next to
  your own.
