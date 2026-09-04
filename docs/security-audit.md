# Production dependency audit

The production dependency gate is run with:

```text
corepack pnpm audit --prod --audit-level high --registry=https://registry.npmjs.org
```

The Windows Electron hardening dependency set (Electron 44.2.0,
better-sqlite3 13.0.3, Express 5.2.1 with the pinned router dependencies,
ws 8.21.3, axios 1.20.0 and yaml 2.9.0) reports **no known vulnerabilities**.

The `pnpm.overrides` entries for `body-parser`, `path-to-regexp` and `qs`
are limited to patched versions and are covered by the server binding,
security boundary, analytics and desktop directory-build checks in CI.
