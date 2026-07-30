# Security model

Karto 2.0 runs entirely in the browser. Its trust boundary is the site origin and the browser profile.

## Trusted local state

Decks, cards, article text, sources, preferences, progress, and sessions are held in IndexedDB. Service-worker storage contains only static application assets.

## Untrusted input

- article URLs and returned HTML;
- pasted article text;
- remote and uploaded images;
- imported JSON backups.

Article HTML is reduced to text with `DOMParser`; it is never inserted as executable HTML. React escapes all displayed text. Imported backup records are normalized to the current relational model.

## Network boundary

The CSP permits HTTPS connections because the user may choose any open source. Karto does not proxy those requests or attach credentials. Publishers may deny cross-origin access, in which case the user can paste text locally.

## Release checks

Run strict TypeScript checks, the unit suite, the production PWA build, and the production dependency audit before release.
