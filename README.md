# C7: the tutorial swap board

MyTimetable's swap request is blind: you ask to move into a full class and
wait, with no view of who else wants yours and no way to talk to them. C7 is
a small parallel system for one course's COMP4020 crit-group sessions: a
student posts the class they're leaving and the classes they'd join, another
student who's happy to swap says so, and the poster accepts or declines. It
makes swapping visible, discussable and agreed by both students — it cannot
change a real ANU allocation, and nothing here is official.

All of it is built and deployed: the login and eight demo students, the board
of swap posts, editing and withdrawing a post, offers with accept and decline,
comments, private messages, live updates and the transit-board look. The site
calls itself "Swap Board", and its classes are crit-group sessions, not
tutorials.

## What good looks like here

**A simple, real login, not automatic matching.** Private messages between
students aren't private without real accounts, so C7 uses a plain username
and password (not ANU single sign-on) rather than skip identity altogether.
Signing up is open to anyone: a tutor at the crit can be themselves, or use a
seeded demo student. Because C7 does no automatic matching — no pairing, no
cycles, no "fits your post" hint — a student finds a swap by reading the
board and agrees it with an offer the poster accepts. That keeps the whole
system legible: every match on the board was two people choosing each other,
not an algorithm's guess.

**Everything except this README, the login and the sign-up form is behind
the login.** A logged-out visitor gets the login page at `/`, so the board's
own content is never visible without an account; every other page redirects
to `/login/` and returns them where they were headed once they're in. A
login lasts 30 days on that browser, stored as a row in the database so it
survives a redeploy, with a visible "Log out" on every logged-in page.

**Demo login, not ANU single sign-on.** Don't use your ANU password. Anyone
can sign up or use a demo student, so treat what you post as visible to
strangers. Demo students are shared, so their messages aren't private. Private
messages can be read only by the two students in the conversation, which for
a demo student means anyone. They are stored unencrypted, and whoever runs
the site can read them. There is no rate limiting, password reset or account
deletion.

**Eight demo students, one shared password.** The login page has a
one-click button for each of `Alex`, `Priya`, `Sam`, `Lena`, `Jordan`, `Mei`,
`Noah` and `Zara`, plus "Random demo student". They share the password
`demo-student`, published here, for anyone who would rather type it in the
ordinary form. Their names are taken: signing up as one fails like any other
duplicate. The demo students are written once, when the database has none;
a server restart never rewrites them.

**Resetting the demo is the operator's job, and the app has no button for
it.** `pnpm seed:reset` locally, or `fly ssh console -C "node dist/seed-reset.mjs"`
on Fly, deletes every swap post, offer, comment and private message that
involves a demo student, including a real student's post swapped through a
demo student's accepted offer, then writes the demo seed again, all in one
transaction. Real students keep their accounts and everything that involves
only real students.

**Real names and uni IDs are allowed**, since the demo-login notice above
already tells a student who can read what they post.

**The board is home.** `/` lists every open swap post, newest first. On a
wide screen a side column holds the student's own post under "Your swap" (or
a "Post a swap" button when they have none) and, once they have made an
offer, "Your offers"; beside it sit the open posts. On a phone the columns
stack in that order. Each entry reads GIVING (the class being left) →
LOOKING FOR (the classes that would do), with the message cut short and the
counts of pending offers and comments. A post names the class the student is
leaving, one or more classes they would join (never the one they are leaving)
and an optional message of up to 500 characters. A student has at most one
open post. Each post has its own page at `/posts/<id>/` with the whole
message, and it still loads after the post is withdrawn or swapped. Every
time shown is Canberra time.

**A post can be edited until someone offers, and withdrawn any time.** The
poster can change the classes and message while the post has no pending
offers (a declined offer doesn't lock it), and an edited post says so with the
time. Withdrawing takes the post off the board, closes its pending offers and
lets the student post again.

**An offer is "I'm happy to swap", made from the post's page.** Any other
student can offer on an open post by naming the one join class they hold and
would leave; an offer carries no message, since talking happens in comments
and private messages. A student has at most one pending offer per post and can
withdraw it until it is accepted; after a decline they can't offer on that
post again. Everyone sees how many offers a post has, but only the poster
sees who offered. The poster accepts or declines each one. Declining is one
click and the post stays open. **Accepting is final**, and a confirm step
says so: the post becomes swapped and leaves the board, and the app closes
the post's other pending offers, every other pending offer made by either
student, and the offerer's own open post. The app then says who moves where
and that the change must be made in MyTimetable, because this app can't make
it. An offerer sees each offer as Pending, Accepted, Declined, You withdrew or
a closed reason.

**Comments are one flat thread on the post's page.** Any logged-in student can
add a plain-text comment of up to 500 characters. Comments can't be edited;
only their author can delete one, which leaves a "Comment deleted" marker.
A withdrawn or swapped post's comments are read-only.

**Private messages are one conversation per pair of students.** A "Message"
link beside a username on a post page opens `/messages/<username>/`, where
plain-text notes of up to 500 characters go back and forth, oldest first.
They can't be edited or deleted. The inbox at `/messages/` lists the
conversations, most recent first, and the header reads "Messages (N)" when N
are unread. A message is unread until its recipient opens the conversation.

**Open pages update live.** The board, a post page and an open conversation
refresh themselves when something changes, with no reload; the header's
"Messages (N)" and the inbox update on reload only. The pages still work
without JavaScript, only correct on reload. The event stream at `/api/events`
is public, so it carries only a post's id and the kind of change, or just "a
private message was sent", never a comment, message, class or name; the page
then refetches its content over its own login.

**Coral means you have something to do.** The one warm colour on the site
marks what is waiting on you: pending offers on your own post, unread private
messages and form errors. Everything else is neutral, and no status is told
by colour alone.

**Unofficial, and it says so.** The design borrows a transit board's
wayfinding vocabulary (navy, cyan, GIVING → LOOKING FOR) and nothing that
looks official: no crest, no ANU gold, no campus imagery. Every page carries
the footer "Unofficial, student-built COMP4020 demo. Not an ANU system: it
can't change your real class allocation."

**The classes are real COMP4020 crit-group sessions.** The six classes
(Mon 14:00, Mon 15:30, Wed 09:00, Wed 10:30, Wed 14:00, Wed 15:30) come from
the course's public crit-groups data at
<https://comp.anu.edu.au/courses/comp4020-agentic-coding-studio/api/crit-groups.json>,
copied into the app on 2026-09-29 and never fetched while it runs. Credit:
COMP4020 Agentic Coding Studio (ANU School of Computing), Ben Swift, from
<https://comp.anu.edu.au/courses/comp4020-agentic-coding-studio/>, licensed
CC BY-NC-SA 4.0. The data is provisional until enrolments settle, so it may
be out of date.

## What's enforced, and what's a judgement call

The rules above that are checkable are asserted against the built server:
the username shape, the password length, case-insensitive uniqueness, the
30-day cookie, the redirect and `next` handling, the guarded pages and the
demo-login notice's presence in `spec/auth.test.ts`; the swap post rules in
`spec/posts.test.ts`, `spec/posts-edit.test.ts` and `spec/events.test.ts`;
offers, accepting and declining in `spec/offers.test.ts` and
`spec/accept.test.ts`; comments, private messages and the inbox in
`spec/comments.test.ts`, `spec/private-messages.test.ts` and
`spec/inbox.test.ts`; the live board and post page in `spec/live.test.ts`;
the demo seed and its reset in `spec/demo-seed.test.ts` and
`spec/seed-reset.test.ts`. Browser tests in `e2e/` check the same flows in
Chrome at 1920×1080 and 390×844, including that the redesigned pages don't
scroll sideways.

Whether the pages actually *read* clearly and look like a board a student
would trust, at a phone width and a desktop one, is a judgement call for the
crit, not something a test can decide. The tests pin the layout's structure
(the split, the exchange row, the coral rule), not whether it is good.

## Not built, on purpose

Automatic matching (pairs, cycles, or a "fits your post" hint) is out of scope
for the whole of C7, not just this slice — a student always finds a swap by
reading the board and agreeing it directly with another student. Also not
built: an offer message, editing or deleting a private message, editing a
comment, unread markers on comments, a block or report feature, and any way
to change a real ANU allocation.
