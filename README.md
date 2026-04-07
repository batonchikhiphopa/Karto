# Karto

A local-first flashcard app built with vanilla JavaScript. Study vocabulary, definitions, and anything else with spaced repetition — no account required, no data leaves your device.

![Karto](logo.svg)

---

## Features

- **Deck management** — create, rename, merge, and delete decks
- **Card editor** — front/back text, images (URL or file upload), live preview
- **Auto-lookups** — fetch definitions and translations while editing cards
- **Image search** — find images via Unsplash and attach them to cards
- **Study mode** — edge-zone gesture UI, keyboard shortcuts, three answer ratings (know it / not sure / don't know)
- **Study progress tracking** — per-card seen/correct history, session history
- **Import/Export** — JSON (full fidelity) and CSV formats, per-deck or full library
- **Merge decks** — combine multiple decks with automatic deduplication
- **Multilingual UI** — English, Deutsch, Русский
- **Themes** — dark, light, system
- **PWA** — installable, works offline via service worker
- **No dependencies on the frontend** — pure vanilla JS, no frameworks

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) v18 or newer

### Installation

```bash
git clone https://github.com/your-username/karto.git
cd karto
npm install
```

### Configuration

Create a `.env` file in the project root:

```env
# Optional — required only for image search
UNSPLASH_ACCESS_KEY=your_unsplash_key_here

# Optional — required only for translation
DEEPL_API_KEY=your_deepl_key_here

# Optional — defaults shown
PORT=3000
HOST=127.0.0.1
```

Get a free Unsplash key at [unsplash.com/developers](https://unsplash.com/developers). Add a DeepL key if you want translations from the card editor. Without these keys, image search and translation are disabled while the rest of the app keeps working.

### Run

```bash
npm start
```

Open [http://127.0.0.1:3000](http://127.0.0.1:3000) in your browser.

### Alternative Dev Flow

You can also keep the API on `http://127.0.0.1:3000` via `npm start` and open the frontend through VS Code Live Server on another localhost port. The client will automatically fall back to:

- same-origin `/api`
- `http://127.0.0.1:3000/api`
- `http://localhost:3000/api`

Live Server is supported only for local development on `localhost` or `127.0.0.1`.

---

## Usage

### Creating a deck

Go to **Library → Create deck**, enter a name, and click Create. You can also create a deck directly from the home screen via the **+** tile.

### Adding cards

Open a deck and click **+ Create card**. Fill in the front (word/question) and back (definition/answer). Optionally:
- Click **Get definition** to auto-fill the back from a dictionary
- Click **Translate** to fetch a translation for the selected target language
- Click **Find images** to search Unsplash
- Upload a local image file

### Studying

Click any deck tile on the home screen, or open a deck and click **Start study**. Choose a mode:

| Mode | Description |
|---|---|
| All cards | Every card in the deck |
| New cards only | Cards you haven't seen yet |
| Review | Cards you've seen at least once |

**In study mode:**

| Action | Controls |
|---|---|
| Flip card | `Space` or click the card |
| Know it | `→` or click the right edge |
| Not sure | `↓` or click the bottom edge |
| Don't know | `←` or click the left edge |
| Go back | `↑` or click the top edge |
| Exit | `Esc` or the ✕ button |

### Import / Export

From the **Library** screen you can export or import your entire library as JSON. Individual decks support both JSON and CSV export. CSV format:

```
"deck name","front text","back text","image url"
```

---

## Project Structure

```
karto/
├── index.html              # Single-page app shell
├── style.css               # All styles, CSS custom properties for theming
├── app.js                  # App entry point, wires everything together
├── i18n.js                 # Translations (en, de, ru) and i18n utilities
├── server.js               # Express server — dictionary, translation, image proxy, static files
├── sw.js                   # Service worker for offline support
├── manifest.webmanifest    # PWA manifest
├── js/
│   ├── data-model.js       # Deck/card creation, normalization, deduplication, import/export
│   ├── study-engine.js     # Spaced repetition queue logic
│   ├── app-state.js        # State management, localStorage persistence
│   ├── router.js           # Screen routing
│   ├── api.js              # Client-side API wrapper (definitions, translations, images)
│   ├── dom-utils.js        # createElement helpers
│   ├── pwa.js              # Service worker registration
│   ├── ui/
│   │   ├── sidebar.js      # Navigation sidebar
│   │   └── toast.js        # Toast notifications
│   └── views/
│       ├── home-view.js    # Deck grid
│       ├── library-view.js # Library, create/merge/import
│       ├── deck-editor-view.js  # Card list, bulk actions, drag-and-drop
│       ├── card-form-view.js    # Card create/edit form
│       ├── study-view.js   # Study mode UI
│       └── settings-view.js    # Language, theme, session history
└── tests/
    ├── data-model.test.js
    ├── study-engine.test.js
    ├── i18n.test.js
    ├── api.test.js
    ├── export-import.test.js
    └── server.test.js
```

---

## API Endpoints

The server exposes four endpoints:

| Endpoint | Description |
|---|---|
| `GET /api/health` | Health check |
| `GET /api/define?word=&dictLang=` | Word definition (en/de/ru) |
| `GET /api/translate?text=&targetLang=` | Translation via DeepL (en/de/ru) |
| `GET /api/images?query=` | Image search via Unsplash |

Dictionary sources: [dictionaryapi.dev](https://dictionaryapi.dev) (English), [dwds.de](https://www.dwds.de) (German), [ru.wiktionary.org](https://ru.wiktionary.org) (Russian).

The API is rate-limited per IP: 20 req/min for definitions, 20 req/min for translations, and 12 req/min for images. Definitions are cached for 30 minutes.

---

## Running Tests

```bash
npm test
```

Tests cover data model normalization and deduplication, study engine queue logic, i18n interpolation and pluralization, API client fallback behaviour, export/import round-trips, and server endpoint behaviour.

---

## Data Storage

All user data is stored in `localStorage` under these keys:

| Key | Contents |
|---|---|
| `decks` | All decks and cards (JSON) |
| `karto.studyProgress` | Per-card seen/correct counters |
| `karto.studySessions` | Last 20 study session summaries |
| `karto.theme` | Theme preference |
| `language` | UI language |

No data is sent to any server. The backend only proxies dictionary and image requests.

---

## License

MIT
