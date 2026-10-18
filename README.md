# Notes — v3 (source)

Mobile-first, offline notes PWA. Thumb-first layout, liquid glass. React 19 + TypeScript + Zustand, Vite, no UI kit.

```
npm i
npm run dev      # local
npm run build    # → dist/ (deployed to branch notes-v3-site)
```

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
