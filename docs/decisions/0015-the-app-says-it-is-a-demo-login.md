# 0015. The README and the sign-up form say it is a demo login

- Status: Accepted
- Date: 2026-09-28
- Decided by: Matt
- Source: #5

## Decision

The README and a note on the sign-up form both say: "Demo login, not ANU
single sign-on. Don't use your ANU password. Anyone can sign up or use a demo
student, so treat what you post as visible to strangers. Demo students are
shared, so their messages aren't private." The README also says there is no
rate limiting, password reset or account deletion.

Real names and uni IDs are not discouraged.

## Reason

Matt on Q7: "I like your recommendation but allow real name and uni ID, just
don't use ANU password". Q10: accepted the recommended wording, which tells
students who can read what they post now that real names and uni IDs are
allowed and demo students are shared.

## Consequences

The login slice adds this text to `README.md` (served whole at `/readme/`)
and to the sign-up form.
