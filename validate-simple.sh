#!/bin/bash

# Simple Pomodoro Timer Validation Script
# 簡單快速的驗證腳本

echo "🔍 Pomodoro Timer Quick Validation"
echo "=================================="

# Test counters
PASS=0
FAIL=0

# Helper function
check() {
    if [ $1 -eq 0 ]; then
        echo "✓ $2"
        ((PASS++))
    else
        echo "✗ $2"
        ((FAIL++))
    fi
}

# 1. Check required files
echo -e "\n📋 Checking Files..."
[ -f "package.json" ] && echo "✓ package.json" || echo "✗ package.json"
[ -f "index.html" ] && echo "✓ index.html" || echo "✗ index.html"
[ -f "index.js" ] && echo "✓ index.js" || echo "✗ index.js"
[ -f "eslint.config.js" ] && echo "✓ eslint.config.js" || echo "✗ eslint.config.js"
[ -d "assets" ] && echo "✓ assets directory" || echo "✗ assets directory"

# 2. Check dependencies
echo -e "\n📦 Checking Dependencies..."
if command -v pnpm >/dev/null 2>&1; then
    echo "✓ pnpm available"
    if [ -d "node_modules" ]; then
        echo "✓ Dependencies installed"
        DEPS_OK=1
    else
        echo "✗ Dependencies not installed"
        echo "  Run: pnpm install"
        DEPS_OK=0
    fi
else
    echo "✗ pnpm not found"
    DEPS_OK=0
fi

# 3. Check JavaScript functions
echo -e "\n🔧 Checking JavaScript Functions..."
grep -q "soundEffect" index.js && echo "✓ soundEffect function" || echo "✗ soundEffect function"
grep -q "showNotification" index.js && echo "✓ showNotification function" || echo "✗ showNotification function"
grep -q "if (title && message)" index.js && echo "✓ Notification fix applied" || echo "✗ Notification fix missing"

# 4. Check for debug statements
echo -e "\n🧹 Checking Code Cleanliness..."
if grep -q "console\.\(log\|warn\|error\|debug\)" index.js; then
    echo "⚠ Debug statements found (consider removing)"
else
    echo "✓ Debug statements removed"
fi

# 5. Run code quality checks (if deps available)
if [ $DEPS_OK -eq 1 ]; then
    echo -e "\n⚡ Running Code Quality Checks..."
    
    if pnpm run lint >/dev/null 2>&1; then
        echo "✓ ESLint passed"
    else
        echo "✗ ESLint failed"
    fi
    
    if pnpm exec prettier --check "*.{js,html,css,scss,json}" >/dev/null 2>&1; then
        echo "✓ Code formatting OK"
    else
        echo "⚠ Code formatting needs attention"
    fi
else
    echo -e "\n⚡ Skipping code quality checks (no dependencies)"
fi

# 6. Quick functionality check
echo -e "\n🔧 Checking Core Functionality..."
[ -f "assets/audio_break.mp3" ] && echo "✓ Audio files present" || echo "✗ Audio files missing"
[ -f "assets/favicon/favicon-32x32.png" ] && echo "✓ Favicon present" || echo "✗ Favicon missing"

# Summary
echo -e "\n📊 Summary"
echo "=========="
echo "This is a basic validation. For complete testing:"
echo "  • Start the app: pnpm run dev"
echo "  • Test timer functionality manually"
echo "  • Test notifications"
echo "  • Test all settings"
echo ""
echo "Development commands:"
echo "  • pnpm run dev     - Start development server"
echo "  • pnpm run lint    - Check code quality"
echo "  • pnpm run format  - Format code"
echo "  • pnpm run check   - Lint + format"
echo ""

if [ $DEPS_OK -eq 1 ]; then
    echo "🎉 Ready for development!"
else
    echo "⚠️  Run 'pnpm install' first"
fi