#!/bin/bash
# Migration gate (`pnpm db:check`). Run it after staging the migrations you
# intend to commit. It fails when:
#   - drizzle/ is internally inconsistent (drizzle-kit check), or
#   - src/lib/schema.ts has changes no committed or staged migration covers:
#     `drizzle-kit generate` then writes new output, and new output is drift.
# The migration it writes on failure is left in place for you to review.
set -uo pipefail

if ! pnpm exec drizzle-kit check; then
	echo "✗ drizzle-kit check failed (output above): usually conflicting or hand-edited migrations in drizzle/" >&2
	exit 1
fi

# A rename or drop makes drizzle-kit ask a question, which needs a TTY; without
# one, drizzle-kit 0.31 prints an error, writes nothing and still exits 0. So
# success is its own report of an outcome, not its exit code.
out=$(timeout 120 pnpm -s db:generate </dev/null 2>&1)
status=$?
echo "$out"
if [ $status -ne 0 ] || ! grep -qE "No schema changes|Your SQL migration file" <<<"$out"; then
	echo "✗ drizzle-kit generate did not finish: a rename/drop needs an interactive terminal (run \`pnpm db:generate\` there, then stage the migration)" >&2
	exit 1
fi

if ! git diff --quiet -- drizzle/ || [ -n "$(git ls-files --others --exclude-standard drizzle/)" ]; then
	echo "✗ drift: src/lib/schema.ts has changes no committed or staged migration covers. drizzle-kit wrote:" >&2
	git status --short -- drizzle/ >&2
	echo "Review it, stage it with the schema change, and rerun." >&2
	exit 1
fi

echo "✓ migrations consistent and in step with src/lib/schema.ts"
