---
name: prototype
description: Build a throwaway prototype on a prototype/<name> branch to answer one question discussion could not settle, show it to Matt, and record his verdict on the decision issue.
argument-hint: "<decision-issue-number>"
disable-model-invocation: true
model: opus
---

# Prototype: one question, Matt's verdict

A prototype that answers the wrong question is waste, however good it looks.
Pattern: Pocock's prototype (github.com/mattpocock/skills,
docs/engineering/prototype.md).

1. Read the issue (`gh issue view $ARGUMENTS --comments`). Write the one
   question in a sentence and confirm it with Matt before building. Claim the
   issue (`--add-assignee @me --add-label in-progress`).
2. Pick the branch by the question:
   - **Logic / state model** (e.g. how offers match): one self-contained HTML
     file, no build step or server. The question at the top; a labelled state
     panel that re-renders after every click; free-play buttons; tabs with
     guided scenarios. Logic in a small pure function block, DOM-free.
     Labels in `CONTEXT.md` words.
   - **UI** (what it should look like): two or three variants that disagree
     about structure, not colour, switched by `?variant=` and a floating bar.
3. `git switch -c prototype/<name>` from main. No persistence, no tests, no
   error handling beyond running, no polish. Finish in one sitting; if it
   can't be, the question needs splitting.
4. Commit on the branch (`Refs #N`) and `git push -u origin prototype/<name>`.
   Give Matt the file path to open (on WSL: `explorer.exe <file>`), and ask
   the question.
5. Post on the issue: the question, the branch link
   (`https://github.com/<repo>/tree/prototype/<name>`), and Matt's verdict
   quoted verbatim. Record the decision as `/grill` does (decision record,
   glossary, map line). Label `ready-for-human`; Matt closes.
6. `git switch main`. The branch is never merged; main keeps the decision
   and none of the prototype.
