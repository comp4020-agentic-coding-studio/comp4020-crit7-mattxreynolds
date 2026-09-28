#!/bin/bash
# Creates (or updates) the tracker vocabulary the skills rely on: state labels,
# wayfinder ticket types, issue kinds, and the C7 milestone. Idempotent: safe
# to re-run after editing a colour or description here.
set -euo pipefail

label() { gh label create "$1" --color "$2" --description "$3" --force >/dev/null && echo "label: $1"; }

# State: new reports start in needs-triage; agreed work moves
# ready-for-agent -> in-progress -> ready-for-human; only Matt closes.
label needs-triage     "fbca04" "New bug or request, not yet triaged"
label needs-info       "d876e3" "Blocked on information from the reporter or Matt"
label ready-for-agent  "0e8a16" "Agreed and unblocked: an agent may claim it"
label in-progress      "1d76db" "Claimed by the session working it"
label ready-for-human  "5319e7" "Implemented and verified: waiting on Matt's acceptance"
label wontfix          "ffffff" "Will not be worked on"

# Wayfinder: the map and its decision tickets (they resolve decisions, not build).
label wayfinder:map        "0b3d91" "Decision map: destination, decisions so far, fog, out of scope"
label wayfinder:grilling   "c5def5" "Decision settled by discussion with Matt (HITL)"
label wayfinder:prototype  "c5def5" "Decision settled by a throwaway prototype and Matt's verdict (HITL)"
label wayfinder:research   "c5def5" "Decision blocked on an outside fact (AFK)"
label wayfinder:task       "c5def5" "Manual work that unblocks a decision"

# Kinds.
label spec     "006b75" "Parent spec synthesised from a cleared decision map"
label slice    "bfd4f2" "Vertical build slice: acceptance lines, test seam, blockers"
label harness  "444444" "Change to the agent harness (skills, hooks, sensors, rules)"

milestone() {
	local title=$1 due=$2 desc=$3
	if gh api "repos/{owner}/{repo}/milestones?state=all" --jq '.[].title' | grep -qxF "$title"; then
		echo "milestone: $title (exists)"
	else
		gh api "repos/{owner}/{repo}/milestones" -f title="$title" -f due_on="$due" -f description="$desc" >/dev/null
		echo "milestone: $title (created)"
	fi
}

# C7 cutoff: Wednesday 30 September 2026 (AEST, UTC+10).
milestone "C7" "2026-09-30T13:59:00Z" "Crit 7: harness, cleared decision map, and the first persisted swap-offer slice deployed"
