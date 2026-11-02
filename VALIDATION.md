# 🔍 Validation Guide

This project includes automated validation scripts to ensure all functionality works correctly.

## Automated Tests

```bash
pnpm test           # unit tests for the timer, settings and persistence logic
pnpm run test:e2e   # Playwright browser tests (first run: pnpm exec playwright install chromium)
```

Both run in CI (`.github/workflows/ci.yml`) on Node 26 (`.nvmrc`).

## Quick Validation

Run the validation script to check core functionality:

```bash
# Using pnpm
pnpm run validate

# Or directly
./validate-simple.sh
```

## What Gets Validated

### ✅ File Structure

- Required files existence (package.json, index.html, index.js, etc.)
- Assets directory and key files
- Configuration files (ESLint, Prettier)

### ✅ Dependencies

- pnpm availability
- Node modules installation status
- Development dependencies

### ✅ Code Quality

- ESLint validation (no errors)
- Prettier formatting check
- Function presence verification

### ✅ Bug Fixes

- Notification fix validation
- Debug statement removal
- Core functionality checks

## Manual Testing

After automated validation, manually test:

1. **Start the application**

    ```bash
    pnpm run dev
    ```

2. **Test Core Features**
    - ⏰ Timer functionality (start/pause/reset)
    - 🔔 Notifications (enable in settings)
    - 🎵 Audio playback
    - 📝 Todo list management
    - ⚙️ Settings panel
    - 🌙 Dark mode toggle

3. **Test Scenarios**
    - Complete a short work session
    - Complete a break session
    - Add/remove todo items
    - Toggle various settings

## Development Commands

```bash
# Development server
pnpm run dev        # Start with auto-open browser

# Code quality
pnpm run lint       # Check and fix code issues
pnpm run format     # Format code with Prettier
pnpm run check      # Run both lint and format

# Tests
pnpm test           # Unit tests (node:test, Node >= 26.13)
pnpm run test:e2e   # Playwright end-to-end + axe (Chromium)
pnpm run validate   # Legacy quick file/lint check

# Production server
pnpm run serve      # Start server without auto-open
```

## Troubleshooting

### Dependencies Issues

If validation fails due to missing dependencies:

```bash
pnpm install
```

### Code Quality Issues

If ESLint or Prettier issues are found:

```bash
pnpm run check
```

### Notification Issues

If notifications don't work:

1. Check browser notification permissions
2. Ensure notification toggle is enabled in settings
3. Test with a short timer (1-2 minutes)

### Server Issues

If development server won't start:

1. Check if port 3000 is available
2. Try alternative port: `pnpm run serve` (port 8080)
3. Check for conflicting processes

## Continuous Validation

Run validation:

- Before making changes
- After implementing features
- Before committing code
- When debugging issues

This ensures consistent quality and functionality across all changes.
