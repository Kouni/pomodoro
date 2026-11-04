# Contributing

Thanks for taking the time to contribute. This is a small project, so the
process is light: open an issue for anything bigger than a typo, keep pull
requests focused, and make sure CI is green.

## Prerequisites

- Node 26 — the exact version is in `.nvmrc` (`nvm use` or `fnm use`)
- pnpm 10 — `npm install -g pnpm@10` (Node 25 and later no longer ship
  Corepack); pnpm then uses the exact version pinned in `package.json`

```bash
pnpm install
pnpm dev
```

The dev server runs without the service worker. To test the production
behaviour (install prompt, notifications in the background, offline reload)
use `pnpm build && pnpm preview`.

## Before you push

```bash
pnpm run validate        # lint, prettier --check, unit tests, build
pnpm run test:e2e        # first run: pnpm exec playwright install chromium
```

CI runs the same checks plus the e2e suite on Chromium, Firefox and WebKit,
so a change that only passes locally on Chromium will still fail the pull
request.

## Where things go

- `src/composables/` — one composable per concern. Browser APIs
  (`document`, `Worker`, `Notification`, `Audio`, `navigator`) are
  parameters that default to the real globals, so `tests/unit/harness.js`
  can pass fakes
- `src/lib/` — pure functions with no Vue or browser dependency
- `tests/unit/` — behaviour-level `*.test.js` files (timer, settings,
  persistence) that drive the real composables through the fakes in
  `harness.js`; run by `node --test`
- `tests/e2e/` — Playwright specs; shared setup lives in `tests/e2e/fixtures.js`
- `docs/` — guides that stay true over time; dated session logs go in
  `docs/reports/`

New behaviour comes with a test. A bug fix comes with a test that failed
before the fix.

## Commit messages and PR titles

Commits follow [Conventional Commits](https://www.conventionalcommits.org/),
and so does the pull request title, because that is what lands on `main`
when a PR is squash-merged. Real examples from the history:

```text
test(e2e): run the real-timer tests at 3 s per minute on local servers
refactor: split index.js into composables, App.vue and a worker ticker
perf: self-host Roboto and drop the Google Fonts requests
build: override filelist's minimatch to 11.x for the Dependabot alert
ci: run on every pushed branch
```

Use the imperative mood, keep the subject under 72 characters, and explain
the why in the body when it is not obvious from the diff.

## Pull requests

1. Branch from `main`.
2. Fill in the pull request template; link the issue it closes.
3. Keep the diff to one concern. Reformatting or renaming goes in its own PR.
4. Update `README.md` or `docs/` when behaviour or commands change.
5. A maintainer reviews and merges once CI is green.

## Reporting bugs and requesting features

Use the issue forms under **New issue**. For security problems do not open
a public issue; see [SECURITY.md](SECURITY.md).
