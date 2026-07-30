# Security Policy

## Supported version

Security fixes target the latest Karto 2.x release.

## Reporting a vulnerability

Use GitHub private security advisories when available. Otherwise open a minimal issue without exploit details and include the affected version, browser/OS, reproduction steps, and expected/actual behavior.

## Runtime model

Karto is a static client-only PWA:

- no Electron main process, Node integration, Express server, native addon, or filesystem access;
- no provider credentials or application secrets;
- browser IndexedDB is the authority for learning data;
- a Content Security Policy blocks inline scripts, plugins, foreign frames, and non-HTTPS network access outside the app origin;
- arbitrary article import is a direct browser request and remains subject to source CORS policy;
- JSON import is normalized before legacy records are written to IndexedDB.

Embedded data-URL images can make backups large. Remote images reveal the usual request metadata to their host when displayed.

## Local checks

```bash
npm test
npm run build
npm audit --omit=dev
```
