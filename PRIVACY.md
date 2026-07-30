# Privacy

Karto is a client-only local-first PWA. It has no user account, telemetry, advertising SDK, Karto cloud database, or background sync.

## Data stored on the device

The current browser profile stores these records in IndexedDB:

- decks, cards, card images, and additional answer sides;
- study schedule, answers, and session summaries;
- imported articles, reading sources, and reading progress;
- saved words and preferences.

The reading language/category filter uses browser local storage. The service worker cache contains only application assets, not the learning database.

## Network requests

Karto makes a network request only for a visible product action or startup source:

- on the first launch it tries to read the Esquire DE homepage to find five current links; an offline fallback is used if the browser blocks it;
- «Читать с Карто» requests the URL entered by the user directly from that source;
- remote card/article images are loaded from their displayed URL;
- dictionary links such as DWDS open in a new browser tab when selected by the user.

Karto does not send article text to a hidden extraction, translation, analytics, or AI service. Publisher CORS policy can prevent direct URL import; pasted text remains local.

## Backups

JSON export contains the complete local library and can include personal notes, imported article text, and embedded images. Store backup files accordingly. Import reads a file explicitly selected by the user.

## Deleting data

Settings → «Удалить локальные данные» clears Karto's IndexedDB and recreates only the default records. Clearing site data in browser settings also removes the database, preferences, and offline cache.

