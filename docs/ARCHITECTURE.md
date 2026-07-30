# Karto 2.0 architecture

Karto is a client-only local-first PWA. The production build is static and does not require Electron, Express, Rust, Node.js, an account, or a hosted database.

## Runtime

```text
React screens
    ↓
feature repositories and domain logic
    ↓
Dexie
    ↓
IndexedDB in the current browser profile
```

The service worker caches the application shell. User data is not put into the service-worker cache; it stays in IndexedDB.

## Source layout

- `src/app` — application shell and route composition.
- `src/features/library` — decks, cards, images, and card editing.
- `src/features/study` — due-card selection, scheduling, undo, and sessions.
- `src/features/reading` — language/category feed, sources, article import, reader, and saved words.
- `src/features/progress` — local study summaries.
- `src/features/settings` — preferences and portable JSON backups.
- `src/platform` — IndexedDB schema and startup initialization.
- `src/shared` — cross-feature types and small utilities.
- `css/screens/home.css` and `css/screens/study.css` — preserved visual foundations for the deck tiles and fullscreen study screen.

Feature code imports the database only through repositories, except for small read-only live queries where Dexie is the reactive source. UI components do not depend on Electron or filesystem APIs.

## IndexedDB schema

Database name: `karto`.

- `decks`
- `cards`
- `studyProgress`
- `studySessions`
- `readingItems`
- `readingProgress`
- `readingSources`
- `settings`

Dexie version upgrades perform in-place schema migrations. The system deck `Слова из чтения`, default preferences, default source, and the five-item German Esquire starter set are idempotent startup seeds.

## Reading import boundary

Karto first tries a direct browser request for an open URL. Cross-origin policy belongs to the source site, so some URLs cannot be read directly by a browser PWA. In that case the same flow accepts pasted text. Karto does not silently send article URLs or text through a third-party extraction proxy.

## Backups and migration

Settings can export the complete local database to JSON and import it again. The importer accepts both the relational 2.0 backup and the legacy Karto deck format with nested `cards`.

SQLite files from the Electron generation are not read by the browser sandbox. Existing desktop data must be exported to JSON before importing it into the PWA.

