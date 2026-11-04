# Pomodoro Timer

A Pomodoro timer with a task list, ambient music, desktop notifications and
an installable progressive web app, served at https://tomato.kouni.io.

## Develop

```bash
pnpm install
pnpm dev            # Vite dev server
pnpm lint           # ESLint
pnpm test           # unit tests (node:test, Node >= 26.13)
pnpm run test:e2e   # Playwright (first run: pnpm exec playwright install chromium)
pnpm build          # production build in dist/
```

## Layout

```text
index.html             Vite entry page (CSP, icons)
src/main.js            mounts App.vue, registers the service worker
src/App.vue            template and wiring of the composables
src/composables/       useTimer, useSettings, useTodo, useAudio, useNotifications,
                       useTicker, useWakeLock, useTheme, useUi
src/lib/               pure helpers: time.js, storage.js
src/workers/ticker.js  one tick per second from a Web Worker
src/styles/main.scss   styles
public/                copied as-is: audio/, fonts/, icons/, sw-notify.js, CNAME
tests/unit/            composable tests on fakes (tests/unit/harness.js)
tests/e2e/             Playwright specs; real-clock tests use /?minute=N on localhost
```

## Deploy

Every push to `main` runs `.github/workflows/ci.yml` (lint, unit, build,
Playwright on Chromium, Firefox and WebKit) and `.github/workflows/deploy.yml`,
which builds `dist/` and publishes it to GitHub Pages. The Pages source must
be set to "GitHub Actions".
