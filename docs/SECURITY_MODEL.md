# Security Model

Karto is a local desktop app with optional online lookup features.

## Boundaries

- Decks, cards, study progress, recent sessions, and settings are stored locally in SQLite.
- Online image, translation, and dictionary lookups run only when the user invokes those features.
- Desktop capabilities are exposed through preload APIs instead of direct renderer Node access.

## Electron Controls

- `nodeIntegration` is disabled.
- `contextIsolation` and sandboxing are enabled.
- Navigation, permission requests, and new windows are denied unless explicitly allowed.
- The renderer CSP blocks inline scripts and remote code execution.

## Accepted Exceptions

- `style-src 'unsafe-inline'` remains because runtime interaction code updates element styles.
- `img-src http: https:` remains because cards support user-provided image URLs.

Review these exceptions before each major Electron upgrade.
