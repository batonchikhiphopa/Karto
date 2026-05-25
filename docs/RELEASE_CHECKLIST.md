# Release Checklist

Use this checklist before tagging a Karto release.

## Version

- Update `package.json`, `package-lock.json`, `CHANGELOG.md`, and static version tests.
- Confirm the git tag matches the package version, for example `v1.5.4`.

## Quality

- Run `npm run lint`.
- Run `npm test`.
- Run `npm run test:e2e`.
- Run `npm run audit`.
- Run packaging verification for each artifact that will be published.

## Publishing

- Publish only verified artifacts.
- Keep release notes aligned with the changelog.
- Do not commit `dist/`, installers, local databases, `.env` files, or generated test output.
