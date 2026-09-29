# 0050. The interface borrows transit-board vocabulary only, never anything that looks official

- Status: Accepted
- Date: 2026-09-29
- Decided by: Matt
- Source: #30 (map #27)

## Decision

The interface may borrow the wayfinding *vocabulary*: the navy / cyan / coral
palette, the board typography, and the GIVING → LOOKING FOR wording with its
arrows. It may not use a crest, ANU gold, a campus building or anything that
looks like an ANU logo. Copy describes only what the app really does, so it
promises no search, course or stats feature the app lacks. "ANU" may appear as
plain description ("not ANU single sign-on", "Don't use your ANU password"),
never as branding.

## Reason

Matt on Q1: "yes" (taking the recommendation). The app is a student-built
demo of a slice of an ANU system, and official-looking styling or invented
features would mislead. Avoiding the word "ANU" outright would have broken
0015's fixed notice and the README's MyTimetable argument (0007).

## Consequences

- No campus imagery in the hero, header or footer; the mockup's building
  silhouette is dropped.
- The mockup's "A more flexible ANU, by students, for students" and "Same
  campus. More possibilities." lines are not used (see 0053).
- Supports the map's out-of-scope line on real ANU branding (#27).
