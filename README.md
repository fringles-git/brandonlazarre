# Notes — v3 (source)

Mobile-first, offline notes PWA. Thumb-first layout, liquid glass. React 19 + TypeScript + Zustand, Vite, no UI kit.

```
npm i
npm run dev      # local
npm run build    # → dist/ (+ version.json: version, build stamp, commit)
npm run smoke    # build + service worker check + the key paths in a real Chromium
npm run deploy   # test, then put the current notes-v3 commit live
```

## Branches
| Branch | Role |
|---|---|
| `notes-v3` | source — work lands here through pull requests |
| `notes-v3-site` | built site only, written by `npm run deploy`; Hostinger pulls it into `brandonlazarre.fr/notes-v3` (notes-v3.brandonlazarre.fr) |
| `notes-site` | built site of the previous app, still live on notes.brandonlazarre.fr |
| `main` | repository default (licence, readme) |

## Deploy
`npm run deploy` (see `scripts/deploy.mjs`) refuses uncommitted or unpushed work, runs the smoke test, publishes `dist/` as one
commit on `notes-v3-site` (`Build <version>`, with the source commit), then waits until https://notes-v3.brandonlazarre.fr/version.json
reports that build. GitHub Actions runs the same command on every push to `notes-v3` (`.github/workflows/deploy.yml`).
- Roll back: `npm run deploy -- --rollback 26.10.19.8` (or a `notes-v3-site` commit): the old files as a new commit, nothing force-pushed.
- Emergency: `--skip-tests`. No network to the site: `--no-verify`.
- Users get the new version through the service worker: open copies offer “Nouvelle version disponible · Recharger”.

## Map
| File | Role |
|---|---|
| `src/config.ts` | constants, labels, changelog, starter notes |
| `src/types.ts` | Note, Prefs, layers |
| `src/store.ts` | Zustand state + selectors (filter, sort, counts) |
| `src/actions.ts` | persistence, CRUD, editor, formatting, layers, selection, folders, PIN, search |
| `src/features.ts` | import/share, attachments analysis, audio, reminders, study, exports, onboarding, boot |
| `src/gestures.ts` | long-press, swipe, reorder, pull-to-search, drag-to-close, keyboard, paste |
| `src/markdown.ts` | line/inline parsing, edits, entities, tags, flashcards |
| `src/media.ts` | object URLs, waveform, PDF/OCR text, Markdown/HTML/EPUB import, PPTX export |
| `src/db.ts` | IndexedDB, backup, PIN hash |
| `src/ui/*` | Dock, List, Editor, Layers, Sheets, Welcome, kit, icons |
| `src/styles/*` | tokens + components |
| `src/sw.js` | service worker template (files + version injected at build) |

Storage schema and backup format are the same as Notes 26.10.x: a backup from the old app imports here.
