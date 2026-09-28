#!/bin/bash
# Writes a review bundle for the read-only agents (reviewer, evidence-auditor),
# which have Read/Grep/Glob but no Bash: the git output they cannot run
# themselves, saved under .scratch/review/. Prints the bundle's path.
#
#   scripts/review-bundle.sh diff [base]     commits base..HEAD plus uncommitted changes
#                                            (base defaults to the upstream, else HEAD)
#   scripts/review-bundle.sh commits <rev>…  `git show` of each commit or range
#   scripts/review-bundle.sh process         every commit PROCESS.md cites, for the audit
set -euo pipefail

mode=${1:-}
shift || true
mkdir -p .scratch/review
out=".scratch/review/$(date +%Y%m%d-%H%M%S)-${mode:-none}.md"

header() {
	echo "# Review bundle: $mode"
	echo
	echo "Generated $(date -Iseconds) at $(git rev-parse --short HEAD) on $(git rev-parse --abbrev-ref HEAD)."
	echo "Read the files named here directly for full context; cite file:line or short SHAs."
	echo
}

case "$mode" in
diff)
	base=${1:-$(git rev-parse --abbrev-ref --symbolic-full-name '@{u}' 2>/dev/null || echo HEAD)}
	{
		header
		echo "## Commits $base..HEAD"
		echo '```'
		git log --format='%h %s' "$base..HEAD"
		echo '```'
		echo "## Changed files (vs $base, including uncommitted)"
		echo '```'
		git diff --stat "$base"
		echo '```'
		untracked=$(git ls-files --others --exclude-standard)
		if [ -n "$untracked" ]; then
			echo "## Untracked files (not in the diff below; Read them)"
			echo '```'
			echo "$untracked"
			echo '```'
		fi
		echo "## Diff"
		echo '```diff'
		git diff -U5 "$base"
		echo '```'
	} >"$out"
	;;
commits)
	[ $# -gt 0 ] || { echo "usage: scripts/review-bundle.sh commits <rev|range>..." >&2; exit 64; }
	{
		header
		for rev in "$@"; do
			echo "## $rev"
			echo '```diff'
			if [[ "$rev" == *..* ]]; then git log -p -U5 --reverse "$rev"; else git show -U5 "$rev"; fi
			echo '```'
		done
	} >"$out"
	;;
process)
	[ -f PROCESS.md ] || { echo "no PROCESS.md" >&2; exit 1; }
	{
		header
		echo "PROCESS.md is at the repo root; Read it alongside this bundle. Each cited commit follows"
		echo "with its full message and file stat, so claims can be checked against what changed."
		echo
		grep -oE '\[`?[0-9a-f]{7,40}(\.\.\.[0-9a-f]{7,40})?`?\]\(' PROCESS.md | grep -oE '[0-9a-f]{7,40}(\.\.\.[0-9a-f]{7,40})?' | sort -u |
			while read -r cite; do
				echo "## $cite"
				echo '```'
				if [[ "$cite" == *...* ]]; then
					git log --stat --format='commit %h%n%B' "${cite%...*}..${cite#*...}" 2>&1 || echo "UNRESOLVED: $cite"
				else
					git show --stat --format='commit %h %ad%n%B' --date=short "$cite" 2>&1 || echo "UNRESOLVED: $cite"
				fi
				echo '```'
			done
	} >"$out"
	;;
*)
	echo "usage: scripts/review-bundle.sh diff [base] | commits <rev>... | process" >&2
	exit 64
	;;
esac

echo "$out ($(wc -l <"$out") lines)"
