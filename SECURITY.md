# Security Policy

## Supported versions

Security fixes are intended for the latest released version of Karto.

## Reporting a vulnerability

Please report security issues privately through GitHub security advisories when available, or by opening a minimal issue that does not include exploit details.

Include:

- affected version
- operating system
- clear reproduction steps
- expected and actual behavior

## Local app security model

Karto is an Electron desktop app. The renderer runs with `nodeIntegration: false`, `contextIsolation: true`, sandboxing, and a Content Security Policy. Desktop capabilities are exposed through a narrow preload bridge.

Optional online lookup features call third-party services only when configured and used.

## Dependency checks

Run:

```bash
npm run audit
```

The production audit is part of the full local gate:

```bash
npm run test:all
```

