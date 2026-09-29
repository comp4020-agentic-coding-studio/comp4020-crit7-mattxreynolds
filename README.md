# C7: the tutorial swap board

MyTimetable's swap request is blind: you ask to move into a full class and
wait, with no view of who else wants yours and no way to talk to them. C7 is
a small parallel system for one course's COMP4020 crit-group sessions: a
student posts the class they're leaving and the classes they'd join, another
student who's happy to swap says so, and the poster accepts or declines. It
makes swapping visible, discussable and agreed by both students — it cannot
change a real ANU allocation, and nothing here is official.

The login, its demo students and the board with swap posts are built:
offers, comments and private messages arrive in the slices after them.

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

**Seven demo students, one shared password.** The login page has a
one-click button for each of `alex`, `priya`, `sam`, `lena`, `jordan`, `mei`
and `noah`, plus "Random demo student". They share the password
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

**The board is home.** `/` lists every open swap post, newest first, with a
student's own post pinned under "Your post" (or a "Post a swap" button when
they have none). A post names the class the student is leaving, one or more
classes they would join (never the one they are leaving) and an optional
message of up to 500 characters. A student has at most one open post. Each
post has its own page at `/posts/<id>/` with the whole message; the board
cuts a long message short. Every time shown is Canberra time.

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

The rules above that are checkable — the username shape, the password
length, case-insensitive uniqueness, the 30-day cookie, the redirect and
`next` handling, the guarded pages, the demo-login notice's presence — are
asserted in `spec/auth.test.ts` against the built server; the swap post
rules in `spec/posts.test.ts` and `spec/events.test.ts`. Whether the
sign-up and log-in pages actually *read* clearly, at a phone width and a
desktop one, is a judgement call for the crit, not something a test can
decide.

## Not built yet

Editing and withdrawing a swap post, offers, accepting and declining,
comments and private messages are later slices (see the issue tracker). Automatic
matching (pairs, cycles, or a "fits your post" hint) is out of scope for the
whole of this map, not just this slice — a student always finds a swap by
reading the board and agreeing it directly with another student.
