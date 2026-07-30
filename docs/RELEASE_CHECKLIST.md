# Release checklist

## Version and notes

- Update `package.json`, `package-lock.json`, and `CHANGELOG.md`.
- Confirm the tag matches the package version, for example `v2.0.0`.

## Automated quality

- Run `npm ci`.
- Run `npm run check`.
- Confirm `dist/manifest.webmanifest`, `dist/sw.js`, and the hashed JS/CSS bundles exist.

## Browser smoke

- Start `npm run preview`.
- Verify the five-item first-launch reading seed in a clean browser origin/profile.
- Import pasted article text and save one word into «Слова».
- Create a deck and card, then complete and undo one Study answer.
- Reload while offline and confirm the application shell opens.
- Test one desktop width and one mobile width.

## Publishing

- Publish `dist/` to an HTTPS static host with an SPA fallback to `index.html`.
- Keep release notes aligned with the changelog.
- Do not commit `dist/`, local databases, exported backups, or generated test output.
