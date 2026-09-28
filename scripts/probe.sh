#!/bin/bash
# The deploy probes from .github/workflows/checks.yml, runnable by hand. While
# the repo is private CI skips its jobs, so after a manual `flyctl deploy` this
# is how the live app gets the same checks. Keep it in step with checks.yml.
#
#   pnpm probe                       https://<repo-name>.fly.dev
#   pnpm probe http://127.0.0.1:4321 any other base URL (e.g. a local built server)
set -uo pipefail

name=$(git config --get remote.origin.url | sed -E 's#\.git$##; s#.*[/:]##')
APP_URL=${1:-https://$name.fly.dev}
APP_URL=${APP_URL%/}
failed=0
pass() { echo "✓ $*"; }
fail() { echo "✗ $*"; failed=1; }

code=""
for i in 1 2 3 4 5; do
	code=$(curl -s -o /dev/null -w "%{http_code}" "$APP_URL" || true)
	[ "$code" = "200" ] && break
	echo "  attempt $i: HTTP $code, retrying in 10s..."
	sleep 10
done
[ "$code" = "200" ] && pass "online: $APP_URL" || fail "site did not return 200 (last: $code)"

first=$(curl -sN -m 15 "$APP_URL/api/events" | head -c 12 || true)
[ -n "$first" ] && pass "streaming: $APP_URL/api/events" || fail "no bytes from the SSE endpoint"

code=$(curl -s -o /dev/null -w "%{http_code}" -X POST -H "Origin: $APP_URL" \
	-H "Content-Type: application/x-www-form-urlencoded" --data "probe=1" "$APP_URL/" -m 20 || true)
[ "$code" != "403" ] && pass "same-origin POST accepted (HTTP $code)" ||
	fail "same-origin POST refused (HTTP 403): check security.allowedDomains in astro.config.ts"

code=$(curl -s -o /dev/null -w "%{http_code}" -X POST -H "Origin: https://cross-site.example.com" \
	-H "Content-Type: application/x-www-form-urlencoded" --data "probe=1" "$APP_URL/" -m 20 || true)
[ "$code" = "403" ] && pass "cross-site POST refused: CSRF protection is on" ||
	fail "cross-site POST NOT refused (HTTP $code): CSRF protection looks disabled"

if pnpm dlx linkinator "$APP_URL" --recurse --silent --skip "^(?!$APP_URL)" >/tmp/probe-links.log 2>&1; then
	pass "internal links resolve"
else
	fail "broken internal links (see /tmp/probe-links.log)"
	tail -20 /tmp/probe-links.log
fi

exit $failed
