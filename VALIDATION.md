# 🔍 Validation Guide

## Automated Tests

```bash
pnpm test           # unit tests for the composables (node:test, Node >= 26.13)
pnpm run test:e2e   # Playwright browser tests against the production build
                    # first run: pnpm exec playwright install chromium
# Real-timer e2e tests open /?minute=3 (a one-minute round lasts 3 s);
# the scale only works on localhost/127.0.0.1, the deployed site ignores it.
```

Both run in CI (`.github/workflows/ci.yml`, Chromium + Firefox + WebKit) on
Node 26 (`.nvmrc`). `pnpm run test:e2e` builds `dist/` and serves it with
`vite preview` on port 8080 by itself.

## Quick Validation

```bash
pnpm run validate   # or ./validate-simple.sh
```

Checks that the entry files exist (`index.html`, `vite.config.js`,
`src/main.js`, `src/App.vue`, `src/styles/main.scss`), that `pnpm lint`,
`prettier --check .` and `pnpm build` pass, and that `src/` has no
`console.*` statements.

## Manual Testing

1. `pnpm dev` and open the printed URL (service worker is off in dev).
2. `pnpm build && pnpm preview` and open http://localhost:8080 to test the
   production build with the service worker, the install prompt and offline
   reload.
3. Features: timer (play / pause / reset / fast forward), four-round session
   with short and long breaks, infinite mode, auto-start toggles, to-do list
   (add / tick / remove, eight-task cap), settings tabs, light mode, music
   with volume, notifications (allow the permission prompt first).
4. Background tab: start a round, switch tabs for a minute, come back; the
   remaining time must match the wall clock and the cue must have played.

## Development Commands

```bash
pnpm dev            # Vite dev server with hot reload
pnpm build          # production build into dist/
pnpm preview        # serve dist/ on http://localhost:8080
pnpm lint           # ESLint (flat config, eslint-plugin-vue)
pnpm run format     # Prettier --write .
pnpm test           # unit tests
pnpm run test:e2e   # Playwright
pnpm run validate   # quick file / lint / build check
```

## Troubleshooting

- **Missing dependencies**: `pnpm install` (the lockfile is authoritative,
  CI uses `--frozen-lockfile`).
- **Lint or format failures**: `pnpm lint` shows the rule; `pnpm run format`
  fixes formatting.
- **Notifications do not appear**: allow the permission in the browser, turn
  the toggle on in the settings panel, and test with a one-minute round. On
  the production build they are shown through the service worker, so they
  also work while the tab is in the background.
- **Port 8080 busy**: `vite preview --strictPort` refuses to start; stop the
  other process or run `pnpm exec vite preview --port 8081`.
- **Stale build after an update**: the service worker auto-updates on the
  next load; in DevTools → Application → Service Workers use "Update" or
  "Unregister" to force it.
