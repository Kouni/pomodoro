#!/bin/bash
# Quick sanity check for a fresh checkout. The real tests are
# `pnpm test` (unit) and `pnpm run test:e2e` (browser).

PASS=0
FAIL=0
check() {
    if [ "$1" -eq 0 ]; then
        echo "✓ $2"
        PASS=$((PASS + 1))
    else
        echo "✗ $2"
        FAIL=$((FAIL + 1))
    fi
}

echo "🔍 Pomodoro Timer Quick Validation"
for f in package.json index.html vite.config.js src/main.js src/App.vue src/styles/main.scss eslint.config.js public/audio/audio_break.mp3 public/icons/favicon-32x32.png; do
    [ -f "$f" ]; check $? "file: $f"
done
command -v pnpm >/dev/null 2>&1; check $? "pnpm available"
[ -d node_modules ]; check $? "dependencies installed (pnpm install)"
if [ -d node_modules ]; then
    pnpm lint >/dev/null 2>&1; check $? "eslint"
    pnpm exec prettier --check . >/dev/null 2>&1; check $? "prettier"
    pnpm build >/dev/null 2>&1 && [ -f dist/index.html ] && [ -f dist/sw.js ]; check $? "vite build (dist/index.html, dist/sw.js)"
fi
! grep -rq "console\.\(log\|warn\|error\|debug\)" src; check $? "no debug statements in src/"

echo "📊 $PASS passed, $FAIL failed"
exit $FAIL
