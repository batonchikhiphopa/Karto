# Privacy

Karto is designed as a local-first desktop app.

## What stays local

Karto stores the core app data in a SQLite database inside the Electron app data directory on your device:

- decks
- cards
- images saved as card data
- study progress
- recent study sessions
- UI settings

Desktop window preferences are stored in a small JSON file in the same app data area.

## Optional online features

Karto can call online services only when you use the related feature:

- Unsplash image search, if `UNSPLASH_ACCESS_KEY` is configured.
- DeepL translation, if `DEEPL_API_KEY` is configured.
- Public dictionary sources for definition lookup.

The core deck editor, import/export, and study mode continue to work without these keys.

## Backups and export

You can export decks as JSON and import them later. Exported files are controlled by you. Treat them as personal data if your cards contain private notes.

## Deleting data

Karto stores data locally. To fully remove it, delete the app data directory for Karto on your operating system, or use any reset/delete controls provided by the app version you are running.

## No account

Karto does not require a user account and does not sync your library to a Karto-hosted cloud service.

