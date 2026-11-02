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
for f in package.json index.html index.js index.scss index.css eslint.config.js assets/audio_break.mp3 assets/favicon/favicon-32x32.png; do
    [ -f "$f" ]; check $? "file: $f"
done
command -v pnpm >/dev/null 2>&1; check $? "pnpm available"
[ -d node_modules ]; check $? "dependencies installed (pnpm install)"
if [ -d node_modules ]; then
    pnpm exec eslint index.js tests eslint.config.js playwright.config.js >/dev/null 2>&1; check $? "eslint"
    pnpm exec prettier --check "*.{js,html,css,scss,json}" "tests/**/*.js" >/dev/null 2>&1; check $? "prettier"
    pnpm run build:css >/dev/null 2>&1 && git diff --quiet -- index.css; check $? "index.css matches index.scss"
fi
! grep -q "console\.\(log\|warn\|error\|debug\)" index.js; check $? "no debug statements in index.js"

echo "📊 $PASS passed, $FAIL failed"
exit $FAIL
