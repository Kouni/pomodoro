# Pomodoro Timer

[![CI](https://github.com/Kouni/pomodoro/actions/workflows/ci.yml/badge.svg)](https://github.com/Kouni/pomodoro/actions/workflows/ci.yml)
[![Deploy](https://github.com/Kouni/pomodoro/actions/workflows/deploy.yml/badge.svg)](https://github.com/Kouni/pomodoro/actions/workflows/deploy.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

A Pomodoro timer with a task list, ambient music, desktop notifications and
an installable progressive web app. No account, no backend: everything is
stored in your browser.

**Live:** https://tomato.kouni.io

## Features

- Sessions of 1–10 rounds (four by default) with short and long breaks, an
  infinite mode, and auto-start toggles for work and break rounds
- To-do list with up to eight tasks; an optional setting refuses to start a
  session while the list is empty
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

Requires Node 26 (`.nvmrc`) and pnpm 10. Node 25 and later no longer ship
Corepack, so install pnpm with `npm install -g pnpm@10`; pnpm then switches
itself to the exact version pinned in `package.json`.

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
pnpm run validate   # lint, prettier --check, unit tests and build in one go
```

See [docs/testing.md](docs/testing.md) for how the tests are organised, the
manual checks and troubleshooting, and [CONTRIBUTING.md](CONTRIBUTING.md)
for the workflow.

## Project layout

```text
.github/
  ISSUE_TEMPLATE/      bug report and feature request forms
  workflows/           ci.yml (lint, unit, build, Playwright) and deploy.yml (Pages)
docs/
  testing.md           how the tests are organised, manual checks, troubleshooting
  reports/             dated session logs; historical, paths may not match the tree
public/                copied as-is: audio/ and fonts/ (each with its own README
                       and licence terms), icons/, sw-notify.js, CNAME
src/
  main.js              mounts App.vue, registers the service worker
  App.vue              template and wiring of the composables
  composables/         useTimer, useSettings, useTodo, useAudio, useNotifications,
                       useTicker, useWakeLock, useTheme, useUi
  lib/                 pure helpers: time.js, storage.js
  styles/main.scss     styles
  workers/ticker.js    one tick per second from a Web Worker
tests/
  unit/                behaviour tests driving the composables through fakes (harness.js)
  e2e/                 Playwright specs; real-clock tests use /?minute=N on localhost
index.html             Vite entry page (CSP, icons)
vite.config.js         Vite, Vue and PWA (Workbox) configuration
playwright.config.js   browsers, web server and CI settings for the e2e suite
eslint.config.js       lint rules
```

## Deploy

Every pushed branch runs `.github/workflows/ci.yml` (lint, unit, build,
Playwright on Chromium, Firefox and WebKit); Dependabot branches get the
pull-request run only. Pushes to `main` also run
`.github/workflows/deploy.yml`, which builds `dist/` and publishes it to
GitHub Pages. The workflow enables Pages on a new repository by itself; a
repository that already publishes Pages from a branch has to switch
Settings → Pages → Source to "GitHub Actions" once.

## Contributing

Bug reports and pull requests are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md)
first; by participating you agree to the [Code of Conduct](CODE_OF_CONDUCT.md).
To report a vulnerability, follow [SECURITY.md](SECURITY.md).

## License

The code is released under the [MIT License](LICENSE). The project started
as a fork of [marcelmiro/pomodoro](https://github.com/marcelmiro/pomodoro);
the Vue 3, Vite and PWA rewrite is this repository's.

Bundled assets have their own terms:

- Roboto (`public/fonts/`) is under the SIL Open Font License 1.1, see
  [public/fonts/OFL.txt](public/fonts/OFL.txt).
- The audio cues and ambient tracks (`public/audio/`) are third-party
  recordings that are not covered by the MIT licence; what is known about
  them is in [public/audio/README.md](public/audio/README.md).
