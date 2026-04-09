# Karto

A local-first desktop flashcard app built with Electron, vanilla JavaScript, and SQLite. Study vocabulary, definitions, and anything else with spaced repetition, without creating an account or syncing your data to a third-party service.

![Karto](logo.svg)

---

## Features

- **Desktop-first app**: packaged Electron application for Windows, macOS, and Linux
- **SQLite storage**: decks, cards, study progress, sessions, and settings are stored locally in a SQLite database
- **Deck management**: create, rename, merge, reorder, and delete decks
- **Card editor**: front/back text, image URL or upload, and live preview
- **Auto-lookups**: fetch definitions and translations while editing cards
- **Image search**: search Unsplash images and attach them to cards
- **Study mode**: keyboard-friendly review flow with three answer ratings
- **Study tracking**: per-card progress plus recent study session summaries
- **Desktop preferences**: remembers window mode and window bounds between launches
- **Startup verification**: validates the rendered UI before revealing the app window
- **Import / export**: JSON and CSV support for library backup and transfer
- **Multilingual UI**: English, Deutsch, Русский

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) 18 or newer

### Installation

```bash
git clone https://github.com/batonchikhiphopa/Karto.git
cd Karto
npm install
```

### Configuration

Create a `.env` file in the project root only if you want optional online integrations:

```env
# Optional: enables Unsplash image search
UNSPLASH_ACCESS_KEY=your_unsplash_key_here

# Optional: enables DeepL translation requests
DEEPL_API_KEY=your_deepl_key_here

# Optional overrides for the embedded local API server
HOST=127.0.0.1
PORT=3000
```

Without API keys, the core desktop app still works. Only the related online lookup features are disabled.

### Run The Desktop App

```bash
npm start
```

This starts the Electron app and its embedded local API server.

### Run Only The Local API Server

```bash
npm run dev-server
```

Use this only for development or debugging when you want to run the server without launching Electron.

---

## Build And Distribution

### Build Commands

```bash
npm run build
npm run build:win
npm run build:mac
npm run build:linux
```

Generated installers and unpacked bundles are written to `dist/`.

### Release Practice

- Commit source code, tests, icons, and build configuration to git
- Do not commit `dist/`, unpacked Electron bundles, or installer binaries
- Publish generated `.exe`, `.dmg`, and Linux artifacts through GitHub Releases

---

## Usage

### Creating A Deck

Open the library, create a deck, and give it a name. You can then add cards manually or import an existing deck backup.

### Adding Cards

Each card supports:

- front text
- back text
- optional image
- optional auto-filled definitions
- optional translations

### Studying

Study sessions track:

- reviewed cards
- correct answers
- wrong answers
- unsure answers
- recent session summaries

### Import / Export

- Full library backup as JSON
- Per-deck export as JSON or CSV
- Import existing backups into the desktop app

---

## Data Storage

Karto stores user data locally in a SQLite database created in the Electron app data directory.

Stored data includes:

- decks
- cards
- study progress
- recent study sessions
- UI settings and preferences

Desktop window preferences are stored separately in `desktop-preferences.json` inside the same app data area.

Legacy browser `localStorage` import support still exists only as a one-time migration path from older versions. SQLite is the active storage system for the desktop app.

---

## Project Structure

```text
Karto/
├── app.js
├── index.html
├── style.css
├── i18n.js
├── logo.svg
├── main.js
├── preload.js
├── server.js
├── package.json
├── build/
│   └── icon.png
├── js/
│   ├── api.js
│   ├── app-state.js
│   ├── data-model.js
│   ├── dom-utils.js
│   ├── global-shortcuts.js
│   ├── pwa.js
│   ├── router.js
│   ├── sqlite-repository.js
│   ├── startup-verification.js
│   ├── study-engine.js
│   ├── ui/
│   │   ├── sidebar.js
│   │   └── toast.js
│   └── views/
│       ├── card-form-view.js
│       ├── deck-editor-view.js
│       ├── home-view.js
│       ├── library-view.js
│       ├── settings-view.js
│       └── study-view.js
├── scripts/
│   └── verify-dist.js
└── tests/
    ├── api.test.js
    ├── app-state.test.js
    ├── data-model.test.js
    ├── export-import.test.js
    ├── global-shortcuts.test.js
    ├── i18n.test.js
    ├── server.test.js
    ├── sqlite-repository.test.js
    ├── startup-verification.test.js
    └── study-engine.test.js
```

---

## Test Commands

```bash
npm test
npm run verify:dist
```

`npm test` covers the data model, SQLite repository, app state, startup verification helpers, keyboard shortcut logic, import/export, and server behavior.

---

## License

MIT
