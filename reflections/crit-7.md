# Crit 7 reflection

## What was the breakthrough that moved the work forward?

Deciding before building. The idea started as one sentence ("post a swap, accept or decline"). The breakthrough was turning each open question into a decision I answered, recorded in `docs/decisions/` before the slice that needed it. There are 59 records. Once "one open post per student", "accepting closes everything else in flight" and "the live stream carries no content" were settled, each slice had a written rule to build and test against, and a behaviour no record settled became a question for me.

The second half was not trusting green tests. The reviewer found an open redirect that the tests passed, and the first deploy probe found `/api/events` sent to the login page. Both now have tests in `spec/auth.test.ts`. When the e2e suite flaked, I had Claude fix the harness rather than re-run it.

## What did this work change about who I want to be as a software developer?

I now think my job is less typing the code and more owning three things: what the system should do, how we would know it does it, and what it must never do. This week Claude wrote the code, yet each behaviour traces to a decision record I accepted and a check that would fail without it.

I want to keep that discipline: to be the developer who can point at the record for any line of behaviour, who treats "implemented" and "accepted" as different states, and who asks for a second reader before shipping anything that touches auth or data.
