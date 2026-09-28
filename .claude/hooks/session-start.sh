#!/bin/bash
# SessionStart: print where the work stands, so a session resumes from the
# record instead of from memory. Its stdout becomes context for Claude. It
# never fails the session: every lookup is best-effort and says when it can't.
cd "${CLAUDE_PROJECT_DIR:-$(dirname "$0")/../..}" || exit 0

echo "## Session start: $(git rev-parse --abbrev-ref HEAD 2>/dev/null) @ $(git rev-parse --short HEAD 2>/dev/null)"
changes=$(git status --porcelain 2>/dev/null | wc -l)
[ "$changes" -gt 0 ] && echo "Uncommitted: $changes path(s). Read \`git status\` before starting."
ahead=$(git rev-list --count '@{u}..HEAD' 2>/dev/null) && [ "$ahead" -gt 0 ] && echo "Unpushed: $ahead commit(s)."

echo
echo "### Recent commits"
git log --oneline -8 2>/dev/null

echo
echo "### Last handoff (.scratch/handoff.md)"
if [ -f .scratch/handoff.md ]; then
	head -25 .scratch/handoff.md
else
	echo "none: start from the issue and the commits above"
fi

echo
echo "### Tracker"
if ! command -v gh >/dev/null 2>&1; then
	echo "gh not on PATH: run scripts/frontier.sh by hand"
	exit 0
fi
list() { timeout 15 gh issue list --state open --limit 20 "$@" --json number,title --jq '.[] | "#\(.number) \(.title)"' 2>/dev/null; }
claimed=$(list --label in-progress)
echo "In progress (claimed): ${claimed:-none}"
waiting=$(list --label ready-for-human)
echo "Waiting on Matt: ${waiting:-none}"
triage=$(list --label needs-triage)
[ -n "$triage" ] && echo "Needs triage: $triage"

for map in $(list --label wayfinder:map | sed -E 's/^#([0-9]+).*/\1/'); do
	echo "Decision frontier of map #$map:"
	timeout 15 scripts/frontier.sh decisions "$map" 2>&1 | sed 's/^/  /'
done
for spec in $(list --label spec | sed -E 's/^#([0-9]+).*/\1/'); do
	echo "Build frontier of spec #$spec:"
	timeout 15 scripts/frontier.sh build "$spec" 2>&1 | sed 's/^/  /'
done

echo
echo "One issue per session unless the handoff records an exception. Implemented, verified and accepted are separate: only Matt accepts."
exit 0
