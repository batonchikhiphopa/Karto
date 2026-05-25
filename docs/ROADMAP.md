# Roadmap

Karto is a local-first desktop flashcard app. The product direction is to keep study data private, make card creation fast, and keep review behavior understandable.

## Current Priorities

- Keep SQLite persistence reliable across app upgrades.
- Improve spaced-repetition scheduling without adding unnecessary study UI.
- Keep import/export simple and portable through JSON.
- Maintain a small, testable Electron security surface.

## Later

- Add a visible due-card summary on Home.
- Add optional deck-level study settings after the default scheduler has settled.
- Revisit CSV only when there is a clear import/export workflow and tests for it.
