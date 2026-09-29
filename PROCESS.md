# Process overview

## What I built

A swap board for COMP4020's six crit sessions, standing in for MyTimetable's blind tutorial swaps: students post the class they leave and the ones they would join, others comment, offer and message, and the poster accepts or declines. It sits behind a simple demo login and updates live. `README.md` says what good means here.

## How I got here

I built the harness before any feature ([`167fe40...1871a0e`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-mattxreynolds/compare/167fe40...1871a0e)): guarded hooks, a reviewer agent, a probe and a rule that Matt decides while Claude builds and verifies.

**Direction.** Matt chose the problem in a grilling on [#3](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-mattxreynolds/issues/3#issuecomment-5863940083) (recorded in [`ac12c5e`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-mattxreynolds/commit/ac12c5e)):

> I just want to improve the swapping feature all together

He settled the slices' behaviours as decision records committed before the first code ([`ac12c5e...2eb36e0`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-mattxreynolds/compare/ac12c5e...2eb36e0); first schema and code [`80bd5e3`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-mattxreynolds/commit/80bd5e3)), and ruled out automatic matching ([`6072a96`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-mattxreynolds/commit/6072a96)). Later changes were settled with him as records too, after the app existed: the transit-board look ([`cd3d9ef...773b639`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-mattxreynolds/compare/cd3d9ef...773b639)) and the eighth demo student (0059, in [`f410757`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-mattxreynolds/commit/f410757)).

**Grounding.** The classes are the course's published data ([`9871322`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-mattxreynolds/commit/9871322)), credited in the README ([`be293f8`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-mattxreynolds/commit/be293f8)). Each slice then landed as schema, code and spec tests, for example posts ([`388ec43`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-mattxreynolds/commit/388ec43)) and their tests ([`e0d5456`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-mattxreynolds/commit/e0d5456)).

**Correction.** The reviewer found an open redirect that the tests missed, and the first deploy probe found `/api/events` behind the login ([`cb40d67`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-mattxreynolds/commit/cb40d67), [`93adebb`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-mattxreynolds/commit/93adebb); [handoff on #16](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-mattxreynolds/issues/16#issuecomment-5880699111)). Intermittent test failures were filed as harness issues and fixed at the cause: geometry reads racing the live board ([#41](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-mattxreynolds/issues/41), [`ce3e018`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-mattxreynolds/commit/ce3e018)) and axe runs sharing a server under load ([#43](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-mattxreynolds/issues/43), [`e5990e1`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-mattxreynolds/commit/e5990e1)). The last review found the login page's demo lines matching names case-exactly ([`f7f0941`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-mattxreynolds/commit/f7f0941); [handoff on #44](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-mattxreynolds/issues/44#issuecomment-5892086508)).

**Verified.** That #44 handoff records 563 passing tests, 42 passing browser tests and a passing live probe, with screenshots in the comment after it.
