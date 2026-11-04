# Contributing

Thanks for taking the time to contribute. This is a small project, so the
process is light: open an issue for anything bigger than a typo, keep pull
requests focused, and make sure CI is green.

## Prerequisites

- Node 26 — the exact version is in `.nvmrc` (`nvm use` or `fnm use`)
- pnpm 10 — `corepack enable` picks up the version pinned in `package.json`

```bash
pnpm install
pnpm dev
```

The dev server runs without the service worker. To test the production
behaviour (install prompt, notifications in the background, offline reload)
use `pnpm build && pnpm preview`.

## Before you push

```bash
pnpm lint
pnpm exec prettier --check .
pnpm test
pnpm run test:e2e        # first run: pnpm exec playwright install chromium
```

`pnpm run validate` runs the lint, format and build checks in one go. CI
repeats all of the above on Chromium, Firefox and WebKit, so a change that
only passes locally on Chromium will still fail the pull request.

## Where things go

- `src/composables/` — one composable per concern; keep them free of DOM
  access so they stay testable with the fakes in `tests/unit/harness.js`
- `src/lib/` — pure functions with no Vue or browser dependency
- `tests/unit/` — one `*.test.js` per composable, run by `node --test`
- `tests/e2e/` — Playwright specs; shared setup lives in `tests/e2e/fixtures.js`
- `docs/` — guides that stay true over time; dated reports go in
  `docs/reports/`
- `scripts/` — helper scripts invoked from `package.json`

New behaviour comes with a test. A bug fix comes with a test that failed
before the fix.

## Commit messages

Commits follow [Conventional Commits](https://www.conventionalcommits.org/):

```text
feat(timer): add a long-break length setting
fix(todo): keep the eight-task cap after a reload
docs: describe the real-clock e2e scale
test(e2e): cover the install prompt on WebKit
ci: cache the Playwright browsers
build: bump vite to 8.3.5
refactor: move the ticker into a Web Worker
```

Use the imperative mood, keep the subject under 72 characters, and explain
the why in the body when it is not obvious from the diff.

## Pull requests

1. Branch from `main`.
2. Fill in the pull request template; link the issue it closes.
3. Keep the diff to one concern. Reformatting or renaming goes in its own PR.
4. Update `README.md` or `docs/` when behaviour or commands change.
5. A maintainer reviews and squash-merges once CI is green.

## Reporting bugs and requesting features

Use the issue forms under **New issue**. For security problems do not open
a public issue; see [SECURITY.md](SECURITY.md).
