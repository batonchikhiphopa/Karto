# Changelog

## 1.5.0

[Compare with 1.4.0](https://github.com/batonchikhiphopa/Karto/compare/v1.4.0...v1.5.0)

### Added

- Added additional answer sides for cards, including creation, editing, export/import, and SQLite storage.
- Added contextual text limits and tooltips for front, back, and additional-side card fields.

### Changed

- Updated study mode to show answer sides in sequence and keep the selected result pending until the final side.
- Updated desktop startup to wait for full app data and renderer readiness before showing the main window.

### Fixed

- Improved cold-start resilience with a longer startup timeout, readiness polling, and clearer startup diagnostics.

### Tests

- Added unit and smoke coverage for additional answer sides, text limits, startup readiness, and full-data loading.

## 1.4.0

[Compare with 1.3.2](https://github.com/batonchikhiphopa/Karto/compare/v1.3.2...v1.4.0)

### Added

- Added thumbnail and study-sized image variants for cards, including lighter exports for local uploads and remote images.
- Added lazy SQLite app-shell loading with on-demand deck and card media hydration.
- Added keyed home deck tiles with eager preview image loading and cached media signatures.
- Added Electron smoke tests, static quality tests, linting, production dependency audit, Dependabot configuration, privacy documentation, and security documentation.

### Changed

- Made the study-mode Back action restore the previous card and undo the last recorded answer.
- Updated study mode to preload a small window of upcoming media without blocking answer flow.
- Split large CSS, server, and main-process responsibilities into smaller focused modules.
- Tightened release packaging so development-only files and local artifacts stay out of `app.asar`.

### Security

- Added Electron hardening for navigation, window creation, permissions, context isolation, sandboxing, and packaged-app verification.
- Added a renderer Content Security Policy.

### Tests

- Expanded unit and integration coverage for media normalization, lazy SQLite loading, study undo, desktop settings, exports/imports, and package quality checks.
- Added cross-platform CI quality jobs, Electron smoke tests, Windows packaging, and packaged archive verification.

### Docs

- Reworked the README around local-first desktop usage, privacy, security, release practice, screenshots, and quality commands.
- Added `PRIVACY.md`, `SECURITY.md`, and repository metadata for GitHub releases/issues.

### Removed

- Removed PWA/browser install and offline-cache artifacts; Karto is now an Electron desktop app only.
- Removed the legacy browser storage migration bridge and repository import API. Users upgrading from very old pre-SQLite builds should export/import decks manually before moving to this release.
- Removed the standalone development-server script and Windows batch launcher from the supported workflow.

## 1.3.2

- Stabilized the Electron desktop app, SQLite persistence, screenshots, and CI coverage.

## 1.3.1

- Maintenance patch release.

## 1.3.0

- Added desktop-focused improvements and study workflow updates.
