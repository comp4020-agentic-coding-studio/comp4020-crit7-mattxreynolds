# C7: the tutorial swap board

MyTimetable's swap request is blind: you ask to move into a full class and
wait, with no view of who else wants yours and no way to talk to them. C7 is
a small parallel system for one course's COMP4020 crit-group sessions: a
student posts the class they're leaving and the classes they'd join, another
student who's happy to swap says so, and the poster accepts or declines. It
makes swapping visible, discussable and agreed by both students — it cannot
change a real ANU allocation, and nothing here is official.

The login and its demo students are built: everyone else — the board,
offers, comments, private messages — arrives in the slices after it.

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
strangers. Demo students are shared, so their messages aren't private. There
is no rate limiting, password reset or account deletion.

**Seven demo students, one shared password.** The login page has a
one-click button for each of `alex`, `priya`, `sam`, `lena`, `jordan`, `mei`
and `noah`, plus "Random demo student". They share the password
`demo-student`, published here, for anyone who would rather type it in the
ordinary form. Their names are taken: signing up as one fails like any other
duplicate. The demo students are written once, when the database has none;
a server restart never rewrites them.

**Real names and uni IDs are allowed**, since the demo-login notice above
already tells a student who can read what they post.

## What's enforced, and what's a judgement call

The rules above that are checkable — the username shape, the password
length, case-insensitive uniqueness, the 30-day cookie, the redirect and
`next` handling, the guarded pages, the demo-login notice's presence — are
asserted in `spec/auth.test.ts` against the built server. Whether the
sign-up and log-in pages actually *read* clearly, at a phone width and a
desktop one, is a judgement call for the crit, not something a test can
decide.

## Not built yet

Swap posts, the board's content, offers, accepting and declining, comments
and private messages are later slices (see the issue tracker). Automatic
matching (pairs, cycles, or a "fits your post" hint) is out of scope for the
whole of this map, not just this slice — a student always finds a swap by
reading the board and agreeing it directly with another student.
