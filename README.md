# Pomodoro Timer

[![CI](https://github.com/Kouni/pomodoro/actions/workflows/ci.yml/badge.svg)](https://github.com/Kouni/pomodoro/actions/workflows/ci.yml)
[![Deploy](https://github.com/Kouni/pomodoro/actions/workflows/deploy.yml/badge.svg)](https://github.com/Kouni/pomodoro/actions/workflows/deploy.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

A Pomodoro timer with a task list, ambient music, desktop notifications and
an installable progressive web app. No account, no backend: everything is
stored in your browser.

**Live:** https://tomato.kouni.io

## Features

- Four-round session with short and long breaks, an infinite mode, and
  auto-start toggles for work and break rounds
- To-do list with up to eight tasks; a session needs at least one open task
- Ambient music (cafe, nature, rain, music) with a volume control; cues for
  round start, break and finish
- Desktop notifications delivered through the service worker, so they fire
  while the tab is in the background
- Accurate in background tabs: the clock ticks in a Web Worker and is
  reconciled against wall time
- Installable PWA with offline support; the app shell and the short cues are
  precached, music tracks are cached on first play
- Light and dark theme, keyboard operable, checked with axe-core in CI

## Quick start

Requires Node 26 (see `.nvmrc`) and pnpm 10 (`corepack enable`).

```bash
pnpm install
pnpm dev            # Vite dev server with hot reload
pnpm build          # production build in dist/
pnpm preview        # serve dist/ on http://127.0.0.1:8080
```

## Development

```bash
pnpm lint           # ESLint (flat config, eslint-plugin-vue)
pnpm run format     # Prettier --write .
pnpm test           # unit tests (node:test)
pnpm run test:e2e   # Playwright (first run: pnpm exec playwright install chromium)
pnpm run validate   # quick file / lint / format / build check
```

See [docs/testing.md](docs/testing.md) for the test layout, manual checks
and troubleshooting, and [CONTRIBUTING.md](CONTRIBUTING.md) for the
workflow and commit conventions.

## Project layout

```text
.github/
  ISSUE_TEMPLATE/      bug report and feature request forms
  workflows/           ci.yml (lint, unit, build, Playwright) and deploy.yml (Pages)
docs/
  testing.md           how to run and extend the tests
  reports/             dated engineering reports (health check, refactor notes)
public/                copied as-is: audio/, fonts/, icons/, sw-notify.js, CNAME
scripts/
  validate.sh          quick sanity check for a fresh checkout (pnpm run validate)
src/
  main.js              mounts App.vue, registers the service worker
  App.vue              template and wiring of the composables
  composables/         useTimer, useSettings, useTodo, useAudio, useNotifications,
                       useTicker, useWakeLock, useTheme, useUi
  lib/                 pure helpers: time.js, storage.js
  styles/main.scss     styles
  workers/ticker.js    one tick per second from a Web Worker
tests/
  unit/                composable tests on fakes (tests/unit/harness.js)
  e2e/                 Playwright specs; real-clock tests use /?minute=N on localhost
index.html             Vite entry page (CSP, icons)
vite.config.js         Vite, Vue and PWA (Workbox) configuration
playwright.config.js   browsers, web server and CI settings for the e2e suite
eslint.config.js       lint rules
```

## Deploy

Every push runs `.github/workflows/ci.yml` (lint, unit, build, Playwright on
Chromium, Firefox and WebKit). Pushes to `main` also run
`.github/workflows/deploy.yml`, which builds `dist/` and publishes it to
GitHub Pages. The Pages source must be set to "GitHub Actions".

## Contributing

Bug reports and pull requests are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md)
first; by participating you agree to the [Code of Conduct](CODE_OF_CONDUCT.md).
To report a vulnerability, follow [SECURITY.md](SECURITY.md).

## License

[MIT](LICENSE). Roboto is bundled under the Apache License 2.0, see
[public/fonts/README.md](public/fonts/README.md).
