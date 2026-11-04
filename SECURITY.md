# Security Policy

## Supported versions

Only the current `main` branch, as deployed at https://tomato.kouni.io, is
supported. There are no tagged releases to backport to.

## Reporting a vulnerability

Please do not open a public issue for security problems. Report them
privately through GitHub:

https://github.com/Kouni/pomodoro/security/advisories/new

Include the steps to reproduce, the browser and version, and whether the app
was installed as a PWA. This is a one-person project with no guaranteed
response times: reports are acknowledged as soon as the maintainer sees
them, and the fix timeline and the disclosure date are agreed with you in
the advisory thread.

## Scope

The app is a static, client-only site with no backend and no accounts. State
lives in the browser's `localStorage`. Things that count as vulnerabilities
here:

- Content Security Policy bypasses in `index.html`
- Script injection through the to-do list, settings or query parameters
- Service worker or cache behaviour that serves tampered content
- Dependency advisories that reach runtime code in `dist/`

Advisories that only touch build-time tooling are handled through
Dependabot alerts and version updates as upstream releases allow.
