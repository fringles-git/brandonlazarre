# PWA baseline — notes-pwa

## Offline navigation

The service worker uses a network-first strategy for document navigation, but only accepts a successful response as a new shell. Non-2xx responses and navigation timeouts fall back to the cached shell.

## Backups and hidden notes

The legacy JSON backup format is intentionally plaintext. It therefore excludes hidden (`locked`) notes instead of exporting their decrypted content. A future encrypted backup format should be added before allowing hidden notes into a portable JSON backup again.

The Markdown/ZIP vault export already follows the same rule: hidden notes are excluded unless the hidden vault is unlocked in the app.

## Reminders

Reminders are local application reminders. They are checked on boot and periodically while the app is running. The current implementation is not a guaranteed OS-level scheduler while the PWA is completely closed.

For durable calendar scheduling, the existing `.ics` export should be used. A future iteration can add Notification Triggers / platform-specific scheduling where supported, while keeping the current polling fallback.

## Architecture decision

`notes-pwa` remains on React + Vite for now. The current architecture is already client-only, offline-first and heavily browser-API driven; a framework migration would add migration risk without solving the main PWA problems.

A future `branch-gpt` rewrite can be evaluated separately with Svelte 5 + Vite, Dexie for IndexedDB, dedicated workers for OCR/ASR, and WebCrypto for the vault. SvelteKit is not the default recommendation for this app because the current product does not need SSR or server-side data fetching.
