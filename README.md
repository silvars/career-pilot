# CareerPilot

Local-first career assistant. Currently implements:

- **Profile Reader & Knowledge Retrieval** (`src/profile/`) — loads a vendored
  career profile, chunks/indexes it and retrieves relevant context.
- **Job Match & Eligibility Analysis** (`src/job-match/`) — rule-based match
  between a job posting's text and the active profile.
- **Chrome Extension Shell** (`src/extension/`) — Manifest V3 shell (service
  worker, content script, popup) wiring the two layers above into a loadable
  Chrome extension. See `CAREER_PILOT_EXTENSION_SHELL_SDD.md` for the full
  spec and scope boundary (FASE 3 — shell only, no real job-page analysis yet).

## Setup

```bash
npm install
```

## Tests

```bash
npm test
```

## Type-check

```bash
npm run typecheck
```

Runs two passes: the domain code (`tsconfig.json`) and the extension code
(`tsconfig.extension.json`, which adds DOM + `@types/chrome`).

## Updating the vendored profile

The profile content under `vendor/profiles/` is synced manually from
`career-pilot-profile`, pinned to a specific commit/tag:

```bash
npm run sync-profile -- --repository <git-url-or-path> --ref <tag-or-commit> --profile rodrigo-matos
```

This never runs automatically — update, review, then commit.

## Building the extension

```bash
npm run build
```

Bundles `service-worker.ts`, `content-script.ts` and `popup.ts` with esbuild,
then copies `manifest.json`, `popup.html`/`popup.css` and the vendored profile
into `dist/`.

## Loading it in Chrome

1. `npm run build`
2. Open `chrome://extensions`
3. Enable **Developer mode**
4. Click **Load unpacked** and select the generated `dist/` folder
5. Open any `http(s)://` page, then open the CareerPilot popup
6. The popup should show the active profile name, extension status
   ("Ready"), and whether the content script on the current page is
   reachable ("Connected" / "Unavailable on this page")

Pages such as `chrome://*` and the Chrome Web Store cannot host content
scripts — the popup will correctly report the page as unavailable there.
