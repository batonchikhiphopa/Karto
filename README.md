# Karto

Karto 2.0 is a local-first PWA for reading real language materials, saving useful words, and reviewing them as cards. The application is written in React and TypeScript; data stays in IndexedDB in the current browser profile.

![Karto](logo.svg)

## What is included

- «Читаем с Карто» with a material-language selector (`de` is active first).
- German categories: Gesellschaft, Kultur & Unterhaltung, Arbeit & Leben, Technologie, and Style.
- Five Esquire DE starter materials on first launch, with an offline fallback.
- A custom source for each category.
- Article import by an open URL or pasted text.
- Reader word selection, DWDS lookup, and direct save to the system «Слова» deck.
- Deck tiles, card editor, images, additional answer sides, and JSON backups.
- Fullscreen Study with edge controls, keyboard shortcuts, undo, due dates, and local progress.
- Installable and offline-capable static PWA.

## Run locally

Requirements: Node.js 24 or newer for development tooling.

```bash
npm install
npm start
```

Open the Vite URL shown in the terminal.

```bash
npm test          # strict TypeScript check + scheduler tests
npm run build     # static PWA in dist/
npm run preview   # preview the production build
```

The production bundle does not need Node.js. Serve `dist/` from any HTTPS static host with an SPA fallback to `index.html`.

## Data and migration

All decks, cards, images, articles, sources, settings, study progress, and sessions are stored in IndexedDB. Use Settings → «Скачать JSON» before clearing browser storage or moving to another browser/device.

The importer supports Karto 2.0 backups and the legacy JSON deck format. A browser cannot directly open an old Electron SQLite database; export that data to JSON before switching.

Direct article loading follows browser CORS rules. If a publisher blocks cross-origin access, paste the text in the same «Читать с Карто» dialog. No extraction proxy receives the article behind the scenes.

## Architecture

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

The two visual areas intentionally retained from the desktop generation are:

- `css/screens/home.css` for deck tiles;
- `css/screens/study.css` for fullscreen Study.

Everything that executes at runtime is now React/TypeScript. Electron, Express, the SQLite repository, and legacy JavaScript views have been removed.

## Privacy and security

See [PRIVACY.md](PRIVACY.md) and [SECURITY.md](SECURITY.md).

## License

MIT
