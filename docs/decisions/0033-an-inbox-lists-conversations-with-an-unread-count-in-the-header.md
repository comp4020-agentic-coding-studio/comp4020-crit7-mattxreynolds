# 0033. An inbox at `/messages/` lists conversations, and the header shows an unread count

- Status: Accepted
- Date: 2026-09-28
- Decided by: Matt
- Source: #11

## Decision

- The header has a "Messages" link to `/messages/`, with the number of
  unread private messages, e.g. "Messages (2)". With none unread it reads
  "Messages".
- The **inbox** at `/messages/` lists the student's conversations (0031),
  most recent activity first. Each row shows the other student's username,
  a preview of the last private message and its time, and links to the
  conversation. A conversation with unread messages is shown in bold.
- A private message is unread until its recipient opens the conversation.
  Opening it marks every private message received there as read.
- With no conversations yet, the inbox says so and explains that
  conversations start from a "Message" link on a post page (0030).

## Reason

Matt took the recommendation for Q4 ("yes"). Comments have no unread state
because a poster finds them on their post page (0028). A private message has
no such place, so without a count a poster would never know an offerer had
written. It costs one read time per private message.

## Consequences

- Each private message stores when its recipient read it (empty until
  then).
- Loading `/messages/<username>/` updates the read time. That is the one GET
  that writes, and it only touches the viewer's received messages.
- The header count and inbox update on reload, not live (0034).
