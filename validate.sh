#!/bin/bash

# Pomodoro Timer Quick Validation Script
# 快速驗證所有核心功能

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

# Test counters
PASSED=0
FAILED=0
TOTAL=0

# Helper functions
print_header() {
    echo -e "${BOLD}${CYAN}===============================================${NC}"
    echo -e "${BOLD}${CYAN}🔍 Pomodoro Timer Validation${NC}"
    echo -e "${BOLD}${CYAN}===============================================${NC}"
}

print_section() {
    echo -e "\n${BOLD}${BLUE}📋 $1${NC}"
    echo "-----------------------------------------------"
}

test_pass() {
    echo -e "${GREEN}✓${NC} $1"
    ((PASSED++))
    ((TOTAL++))
}

test_fail() {
    echo -e "${RED}✗${NC} $1"
    ((FAILED++))
    ((TOTAL++))
}

test_warn() {
    echo -e "${YELLOW}⚠${NC} $1"
    ((TOTAL++))
}

# Test functions
test_file_structure() {
    print_section "File Structure"
    
    # Required files
    files=("package.json" "index.html" "index.js" "index.scss" "eslint.config.js" ".prettierrc.json")
    
    for file in "${files[@]}"; do
        if [ -f "$file" ]; then
            test_pass "File exists: $file"
        else
            test_fail "Missing file: $file"
        fi
    done
    
    # Assets directory
    if [ -d "assets" ]; then
        test_pass "Assets directory exists"
        
        # Check key assets
        key_assets=("assets/audio_break.mp3" "assets/audio_work.mp3" "assets/favicon/favicon-32x32.png")
        for asset in "${key_assets[@]}"; do
            if [ -f "$asset" ]; then
                test_pass "Asset exists: $(basename $asset)"
            else
                test_fail "Missing asset: $(basename $asset)"
            fi
        done
    else
        test_fail "Assets directory missing"
    fi
}

test_dependencies() {
    print_section "Dependencies"
    
    # Check if pnpm is available
    if command -v pnpm >/dev/null 2>&1; then
        test_pass "pnpm is available"
        
        # Check if node_modules exists
        if [ -d "node_modules" ]; then
            test_pass "Dependencies installed"
        else
            test_fail "Dependencies not installed (run: pnpm install)"
        fi
    else
        test_fail "pnpm not found (install pnpm first)"
    fi
}

test_code_quality() {
    print_section "Code Quality"
    
    # Check if node_modules exists first
    if [ ! -d "node_modules" ]; then
        test_fail "Dependencies not installed - skipping code quality checks"
        return
    fi
    
    # ESLint check
    if pnpm run lint >/dev/null 2>&1; then
        test_pass "ESLint validation passed"
    else
        test_fail "ESLint validation failed"
    fi
    
    # Prettier check  
    if pnpm exec prettier --check "*.{js,html,css,scss,json}" >/dev/null 2>&1; then
        test_pass "Code formatting is correct"
    else
        test_warn "Code formatting needs attention (run: pnpm run format)"
    fi
}

test_javascript_functions() {
    print_section "JavaScript Functions"
    
    # Check for key functions
    functions=("soundEffect" "showNotification" "startCountdown" "resetTimer")
    
    for func in "${functions[@]}"; do
        if grep -q "const $func\|function $func" index.js; then
            test_pass "Function exists: $func"
        else
            test_fail "Missing function: $func"
        fi
    done
    
    # Check notification fix
    if grep -q "if (title && message)" index.js; then
        test_pass "Notification fix applied"
    else
        test_fail "Notification fix missing"
    fi
    
    # Check for console.log (should be removed)
    if grep -q "console\.\(log\|warn\|error\|debug\)" index.js; then
        test_warn "Debug statements found (consider removing)"
    else
        test_pass "Debug statements removed"
    fi
}

test_html_structure() {
    print_section "HTML Structure"
    
    # Check for key elements
    elements=("#main-container" "#timer-container" "#settings-container" "#todo-container")
    
    for element in "${elements[@]}"; do
        if grep -q "$element" index.html; then
            test_pass "HTML element exists: $element"
        else
            test_fail "Missing HTML element: $element"
        fi
    done
    
    # Check Vue.js integration
    if grep -q "vue@3\|vue.global" index.html; then
        test_pass "Vue.js integration found"
    else
        test_fail "Vue.js integration missing"
    fi
}

test_build_scripts() {
    print_section "Build Scripts"
    
    # Test if scripts are defined in package.json
    scripts=("dev" "lint" "format" "check")
    
    for script in "${scripts[@]}"; do
        if grep -q "\"$script\":" package.json; then
            test_pass "Script defined: $script"
        else
            test_fail "Missing script: $script"
        fi
    done
}

test_server_start() {
    print_section "Server Test"
    
    # Check if dependencies are installed first
    if [ ! -d "node_modules" ]; then
        test_fail "Dependencies not installed - skipping server test"
        return
    fi
    
    # Test if server can start (quick test)
    echo "Testing if server can start..."
    
    # Start server in background and capture PID
    pnpm run serve >/dev/null 2>&1 &
    SERVER_PID=$!
    
    # Give server time to start
    sleep 3
    
    # Check if process is still running
    if kill -0 $SERVER_PID 2>/dev/null; then
        test_pass "Development server can start"
        # Clean up - kill the server
        kill $SERVER_PID 2>/dev/null || true
        sleep 1
    else
        test_fail "Development server failed to start"
    fi
}

generate_report() {
    echo ""
    echo -e "${BOLD}${CYAN}===============================================${NC}"
    echo -e "${BOLD}${CYAN}📊 VALIDATION REPORT${NC}"
    echo -e "${BOLD}${CYAN}===============================================${NC}"
    
    PERCENTAGE=$((PASSED * 100 / TOTAL))
    
    echo -e "Total tests: ${BLUE}$TOTAL${NC}"
    echo -e "Passed: ${GREEN}$PASSED${NC}"
    echo -e "Failed: ${RED}$FAILED${NC}"
    echo -e "Success rate: ${CYAN}$PERCENTAGE%${NC}"
    
    if [ $PERCENTAGE -ge 90 ]; then
        echo -e "\n${GREEN}🎉 EXCELLENT! All systems operational.${NC}"
        return 0
    elif [ $PERCENTAGE -ge 75 ]; then
        echo -e "\n${YELLOW}⚠️  GOOD. Minor issues detected.${NC}"
        return 0
    else
        echo -e "\n${RED}❌ POOR. Critical issues need attention.${NC}"
        return 1
    fi
}

# Main execution
main() {
    print_header
    
    test_file_structure
    test_dependencies
    test_code_quality
    test_javascript_functions
    test_html_structure
    test_build_scripts
    test_server_start
    
    generate_report
}

# Run if called directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi