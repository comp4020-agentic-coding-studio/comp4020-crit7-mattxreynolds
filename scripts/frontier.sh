#!/bin/bash
# The frontier is computed from the tracker, never curated by hand: the open,
# unblocked, unclaimed children of one parent issue. Decisions and build work
# have separate frontiers, because they have separate parents.
#
#   scripts/frontier.sh decisions <map>   wayfinder:* children of a wayfinder:map issue
#   scripts/frontier.sh build <spec>      slice children of a spec issue that are ready-for-agent
#
# "Unblocked" means every native blocked-by issue is closed; "unclaimed" means
# no assignee and no in-progress label. Blocked and claimed children are
# listed after the frontier so the shape of the map is visible.
set -euo pipefail

mode=${1:-}
parent=${2:-}
if [[ ! "$mode" =~ ^(decisions|build)$ || ! "$parent" =~ ^[0-9]+$ ]]; then
	echo "usage: scripts/frontier.sh decisions|build <parent-issue-number>" >&2
	exit 64
fi

# FRONTIER_JSON=<file> substitutes a saved GraphQL response (the test seam in
# scripts/frontier.test.ts); otherwise the tracker is queried live.
if [[ -n "${FRONTIER_JSON:-}" ]]; then
	json=$(<"$FRONTIER_JSON")
else
	repo=$(gh repo view --json nameWithOwner --jq .nameWithOwner)
	json=$(gh api graphql -F owner="${repo%/*}" -F name="${repo#*/}" -F number="$parent" -f query='
query($owner: String!, $name: String!, $number: Int!) {
  repository(owner: $owner, name: $name) {
    issue(number: $number) {
      title state
      labels(first: 20) { nodes { name } }
      subIssues(first: 100) {
        nodes {
          number title state
          assignees(first: 5) { totalCount }
          labels(first: 20) { nodes { name } }
          blockedBy(first: 50) { nodes { number state } }
        }
      }
    }
  }
}')
fi

if [[ "$mode" == decisions ]]; then
	want_parent="wayfinder:map"
	child='any(.labels[]; startswith("wayfinder:") and . != "wayfinder:map")'
	ready='true'
else
	want_parent="spec"
	child='any(.labels[]; . == "slice")'
	ready='(any(.labels[]; . == "ready-for-agent")) and (all(.labels[]; . != "needs-info" and . != "wontfix"))'
fi

jq -r --arg want "$want_parent" --arg mode "$mode" "
  .data.repository.issue as \$p
  | if \$p == null then \"no issue #$parent\" | halt_error(1) else . end
  | if ([\$p.labels.nodes[].name] | index(\$want)) == null
    then \"#$parent is not labelled \(\$want): the \(\$mode) frontier hangs off a \(\$want) issue\n\" | halt_error(1)
    else . end
  | [\$p.subIssues.nodes[]
      | .labels = [.labels.nodes[].name]
      | select(.state == \"OPEN\" and ($child))
      | .blockers = [.blockedBy.nodes[] | select(.state == \"OPEN\") | \"#\(.number)\"]
      | .claimed = (.assignees.totalCount > 0 or any(.labels[]; . == \"in-progress\"))
      | .type = ([.labels[] | select(startswith(\"wayfinder:\") or . == \"slice\") | sub(\"wayfinder:\"; \"\")] | join(\",\"))
    ] as \$open
  | (\$open | map(select((.blockers | length) == 0 and (.claimed | not) and ($ready)))) as \$front
  | \"\(\$mode) frontier of #$parent (\(\$p.title)):\",
    (if (\$front | length) == 0 then \"  (empty)\" else (\$front[] | \"  #\(.number) [\(.type)] \(.title)\") end),
    (\$open[] | select((.blockers | length) > 0) | \"  blocked: #\(.number) \(.title) (by \(.blockers | join(\", \")))\"),
    (\$open[] | select(.claimed and (.blockers | length) == 0) | \"  claimed: #\(.number) \(.title)\"),
    (\$open[] | select((.blockers | length) == 0 and (.claimed | not) and (($ready) | not)) | \"  not ready: #\(.number) \(.title) [\(.labels | join(\",\"))]\")
" <<<"$json"
