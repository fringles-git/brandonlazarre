/**
 * Smoke test of the built app, run before every push: `npm run smoke` (builds, serves dist/, drives a real Chromium).
 * Covers the paths that must never break: first launch, create, search, Library page, left hand, Quoi de neuf,
 * keyboard selection with undo, photo text, dark theme, the phone Plan closing on a tap, the tablet inspector,
 * bottom sheets, the one-row editor bar, pinned shelf, compact list, quick actions with a mouse, side panels.
 * Every check but the first launch starts with two notes (tests/fixtures/notes.json) seeded into IndexedDB.
 * Looks: a few screens are compared with reference shots in tests/shots/ (clock fixed, motion off). A change beyond
 * 0.3 % of pixels fails and leaves the diff in tests/shots/diff/; `npm run smoke -- --update-shots` accepts it.
 * References belong to the machine and Chromium that made them: SHOTS=off skips the comparison elsewhere (CI).
 * Browser: Playwright's Chromium, or CHROMIUM_PATH (+ optional CHROMIUM_ARGS) for any other build.
 */
import { preview } from 'vite';
import { chromium } from 'playwright-core';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';

const PORT = 4179, APP = `http://localhost:${PORT}/`;
const photo = fileURLToPath(new URL('./fixtures/photo-texte.png', import.meta.url));
const SEED = JSON.parse(fs.readFileSync(new URL('./fixtures/notes.json', import.meta.url), 'utf8'));
/** Runs before the app: creates the database with the two notes, once (a reload finds it and keeps what the test did). */
const seedNotes = notes => {
  const req = indexedDB.open('NotesAppDB', 1);
  req.onupgradeneeded = () => {
    ['notes', 'prefs'].forEach(s => req.result.createObjectStore(s, { keyPath: 'id' }));
    const store = req.transaction.objectStore('notes');
    notes.forEach(n => store.put({ folder: '', by: 'me', pinned: false, locked: false, atts: [], versions: [], ...n }));
  };
  req.onsuccess = () => req.result.close();
};
const SHOTS = fileURLToPath(new URL('./shots/', import.meta.url)), UPDATE = process.argv.includes('--update-shots');
const notes = [];
const server = await preview({ preview: { port: PORT, strictPort: true }, logLevel: 'silent' });
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: process.env.CHROMIUM_ARGS ? process.env.CHROMIUM_ARGS.split(' ') : [],
});

const results = [];
async function check(name, run, { viewport = { width: 390, height: 844 }, colorScheme = 'light', permissions = [], seed = true, mouse = false } = {}) {
  if (process.env.ONLY && !new RegExp(process.env.ONLY).test(name)) return;   // ONLY=hidden npm run smoke: just those
  const ctx = await browser.newContext({ viewport, colorScheme, permissions, hasTouch: !mouse, reducedMotion: 'reduce', locale: 'fr-FR', timezoneId: 'Europe/Paris' });
  const page = await ctx.newPage(), errors = [];
  await page.clock.setFixedTime(new Date('2026-10-19T10:00:00+02:00'));   // same dates on every run, for the shots
  if (seed) await page.addInitScript(seedNotes, SEED);
  page.setDefaultTimeout(20000);
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => m.type() === 'error' && errors.push(m.text()));
  try {
    await page.goto(APP);
    await page.getByRole('button', { name: 'Passer', exact: true }).click();
    await page.waitForSelector('.sheet.welcome', { state: 'detached' });   // nothing left over the screen
    await page.waitForSelector(seed ? '#note-list .card' : '#note-list .first-use');
    await run(page);
    if (errors.length) throw Error('console: ' + errors.join(' | '));
    results.push(['ok', name]);
  } catch (e) {
    results.push(['FAIL', name, e.message.split('\n').filter(l => l.trim()).slice(0, 6).join(' ⏎ ')]);
  }
  await ctx.close();
}
const expect = (ok, what) => { if (!ok) throw Error(what); };
/** Compares the screen with tests/shots/<name>.png; the first run (or --update-shots) writes the reference. */
async function shot(page, name, hide = '') {
  if (process.env.SHOTS === 'off') return;
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(400);
  if (hide) await page.addStyleTag({ content: hide + ' { visibility: hidden !important; }' });
  const now = await page.screenshot({ animations: 'disabled', caret: 'hide' }), file = SHOTS + name + '.png';
  if (UPDATE || !fs.existsSync(file)) {
    fs.mkdirSync(SHOTS, { recursive: true });
    fs.writeFileSync(file, now);
    return void notes.push(`shot ${name}: ${UPDATE ? 'reference updated' : 'new reference'}`);
  }
  const was = PNG.sync.read(fs.readFileSync(file)), is = PNG.sync.read(now), { width, height } = was;
  expect(is.width === width && is.height === height, `shot ${name}: size changed`);
  const diff = new PNG({ width, height }), changed = pixelmatch(was.data, is.data, diff.data, width, height, { threshold: 0.15 }) / (width * height);
  if (changed > 0.003) {
    fs.mkdirSync(SHOTS + 'diff/', { recursive: true });
    fs.writeFileSync(SHOTS + 'diff/' + name + '.png', PNG.sync.write(diff));
    fs.writeFileSync(SHOTS + 'diff/' + name + '.now.png', now);
    throw Error(`shot ${name}: ${(changed * 100).toFixed(2)} % of pixels changed (tests/shots/diff/); if intended: npm run smoke -- --update-shots`);
  }
}
const openNote = async (page, title) => { await page.locator('#note-list .card-open', { hasText: title }).first().click(); await page.waitForSelector('.editor.open'); };
const idbTexts = page => page.evaluate(() => new Promise(done => {
  const req = indexedDB.open('NotesAppDB');
  req.onsuccess = () => {
    const all = req.result.transaction('notes').objectStore('notes').getAll();
    all.onsuccess = () => done(all.result.flatMap(n => (n.atts || []).map(a => a.text || '')).join(' '));
  };
}));

await check('first launch: no sample notes, one invitation; the guide is in Aide; the first note takes its place', async page => {
  expect(!(await page.locator('#note-list .card').count()), 'no notes in the workspace');
  expect(await page.getAttribute('#nav-notes', 'aria-current') === 'page', 'Notes current');
  expect(!(await page.locator('.ambient').count()), 'plain ground once the welcome is gone');
  await page.getByRole('button', { name: 'Lire le guide' }).click();
  await page.waitForSelector('.sheet[data-mode="guide"] .guide-text:has-text("Raccourcis clavier")');
  await page.click('#sheet-close');
  await page.waitForSelector('.sheet', { state: 'detached' });
  expect(!(await page.locator('#note-list .card').count()), 'reading the guide made no note');
  await page.click('.first-action.is-main');
  await page.waitForSelector('.editor.open');
  await page.fill('.editor-title', 'Première');
  await page.click('.editor-dock .fab');
  await page.waitForSelector('#note-list .card-open:has-text("Première")');
  expect(!(await page.locator('.first-use').count()), 'the invitation leaves with the first note');
}, { seed: false });

await check('create: + keeps the dock, opens Créer, a note is written and listed', async page => {
  await page.click('#fab');
  await page.waitForSelector('.layer[data-mode="create"]');
  expect(await page.isVisible('#nav-island'), 'dock stays visible');
  expect(await page.getAttribute('#fab', 'aria-expanded') === 'true', '+ shows as ✕');
  await page.click('#create-note');
  await page.waitForSelector('.editor.open');
  await page.clock.setFixedTime(new Date('2026-10-19T10:05:00+02:00'));   // written a few minutes after it was made
  await page.fill('.editor-title', 'Note de contrôle');
  await page.click('.editor-dock .fab');
  await page.waitForSelector('#note-list .card-open:has-text("Note de contrôle")');
  await page.waitForSelector('.widget[data-tone="yellow"]:has-text("Reprendre"):has-text("Note de contrôle")');
});

await check('slide from +: press, slide onto Note, release — the note opens', async page => {
  const fab = await page.locator('#fab').boundingBox();
  await page.mouse.move(fab.x + fab.width / 2, fab.y + fab.height / 2);
  await page.mouse.down();
  await page.mouse.move(fab.x + fab.width / 2 - 20, fab.y - 20, { steps: 4 });
  await page.waitForSelector('.layer[data-mode="create"] #create-note');
  const tile = await page.locator('#create-note').boundingBox();
  await page.mouse.move(tile.x + tile.width / 2, tile.y + tile.height / 2, { steps: 6 });
  expect(await page.locator('#create-note.is-armed').count() === 1, 'the tile under the finger is armed');
  await page.mouse.up();
  await page.waitForSelector('.editor.open');
});

await check('link: a note travels in a link and comes back as a note', async page => {
  await openNote(page, 'Bienvenue');
  await page.click('#note-more');
  await page.getByRole('button', { name: /Envoyer un lien/ }).click();
  await page.waitForSelector('.toast:has-text("Lien copié")');
  const link = await page.evaluate(() => navigator.clipboard.readText());
  expect(/#n=[\w-]+$/.test(link), 'link with the note in the fragment: ' + link.slice(0, 60));
  await page.click('.editor-dock .fab');
  await page.goto(link);
  await page.waitForSelector('.toast:has-text("Note reçue")');
  expect(await page.inputValue('.editor-title') === 'Bienvenue', 'the received note is open');
}, { permissions: ['clipboard-read', 'clipboard-write'] });

await check('export: every note as Markdown files in a valid .zip', async page => {
  await page.click('#nav-settings');
  const [file] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /Exporter en Markdown/ }).click()]);
  const path = await file.path(), list = execFileSync('unzip', ['-l', path]).toString();
  execFileSync('unzip', ['-tq', path]);   // CRCs and structure
  expect(list.includes('Notes/Bienvenue.md') && list.includes('Notes/Comment utiliser.md'), 'files in the archive: ' + list);
});

const hideBienvenue = async page => {
  await page.getByRole('button', { name: 'Actions : Bienvenue' }).click();
  await page.getByRole('button', { name: 'Masquer', exact: true }).click();
  await page.fill('.pin-input', '1234');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => ![...document.querySelectorAll('#note-list .card-open')].some(c => c.textContent.includes('Bienvenue')));
};
const storedBienvenue = page => page.evaluate(() => new Promise(done => {
  indexedDB.open('NotesAppDB').onsuccess = e => {
    const all = e.target.result.transaction('notes').objectStore('notes').getAll();
    all.onsuccess = () => { const n = all.result.find(x => x.title === 'Bienvenue'); done({ body: n.body, sealed: !!n.sealed?.data, bytes: n.sealed?.data?.byteLength || 0 }); };
  };
}));
const openHidden = async page => {
  await page.click('#nav-library');
  await page.getByRole('button', { name: /Notes masquées/ }).click();
};

await check('hidden notes: the content is encrypted on the device, the PIN opens it', async page => {
  await hideBienvenue(page);
  let rec;
  for (let i = 0; i < 20 && !(rec = await storedBienvenue(page)).sealed; i++) await page.waitForTimeout(250);
  expect(rec.sealed && rec.body === '' && rec.bytes > 100, 'stored sealed, no clear body: ' + JSON.stringify(rec));
  await page.reload();
  await page.waitForSelector('#note-list .card');
  await openHidden(page);
  await page.fill('.pin-input', '1234');
  await page.keyboard.press('Enter');
  await openNote(page, 'Bienvenue');
  await page.waitForSelector('#note-view:has-text("Notes garde vos idées")');
});

await check('hidden notes: notes hidden before encryption are sealed at the first opening', async page => {
  await page.evaluate(async () => {   // the state an older version left: a PIN, a hidden note in clear, no vault
    const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode('notes-pin:1234')))].map(b => b.toString(16).padStart(2, '0')).join('');
    await new Promise(done => {
      indexedDB.open('NotesAppDB').onsuccess = e => {
        const t = e.target.result.transaction(['notes', 'prefs'], 'readwrite');
        t.objectStore('prefs').put({ id: 'PIN', data: 'sha256:' + hash });
        t.objectStore('notes').put({ id: 1, title: 'Ancienne', body: 'Secret en clair', folder: '', by: 'me', created: 1, updated: 1, pinned: false, locked: true, atts: [], versions: [] });
        t.oncomplete = done;
      };
    });
  });
  await page.reload();
  await page.waitForSelector('#note-list .card');
  await openHidden(page);
  await page.fill('.pin-input', '1234');
  await page.keyboard.press('Enter');
  await page.waitForSelector('#note-list .card-open:has-text("Ancienne")');
  const sealed = () => page.evaluate(() => new Promise(done => {
    indexedDB.open('NotesAppDB').onsuccess = e => { const r = e.target.result.transaction('notes').objectStore('notes').get(1); r.onsuccess = () => done(!!r.result.sealed && r.result.body === ''); };
  }));
  let ok = false;
  for (let i = 0; i < 20 && !(ok = await sealed()); i++) await page.waitForTimeout(250);
  expect(ok, 'the old hidden note is now stored sealed');
});

await check('hidden notes: Face ID or fingerprint opens them (virtual authenticator with PRF)', async page => {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('WebAuthn.enable');
  await cdp.send('WebAuthn.addVirtualAuthenticator', { options: {
    protocol: 'ctap2', ctap2Version: 'ctap2_1', transport: 'internal', hasResidentKey: true, hasUserVerification: true,
    isUserVerified: true, hasPrf: true, automaticPresenceSimulation: true,
  } });
  await hideBienvenue(page);
  await page.click('#nav-settings');
  const sw = page.getByRole('switch', { name: /Face ID ou empreinte/ });
  await sw.click();                                   // notes closed: asks the PIN first
  await page.fill('.pin-input', '1234');
  await page.keyboard.press('Enter');
  await page.waitForSelector('.toast:has-text("touchez à nouveau")');
  await sw.click();                                   // now the system prompt (the virtual authenticator answers)
  await page.waitForSelector('.toast:has-text("ajouté")');
  await page.reload();
  await page.waitForSelector('#note-list .card');
  await openHidden(page);
  await page.click('.pin-device');
  await openNote(page, 'Bienvenue');
  await page.waitForSelector('#note-view:has-text("Notes garde vos idées")');
});

await check('shortcut: ?new=voice starts a voice note (or says why it cannot)', async page => {
  await page.goto(APP + '?new=voice');
  await page.waitForSelector('body.is-recording, .toast:has-text("icro"), .toast:has-text("Enregistrement")');
});

await check('search: finds a word inside a note', async page => {
  await page.click('#search-button');
  await page.fill('#search-input', 'surligneur');
  await page.waitForFunction(() => document.querySelectorAll('#note-list .card').length === 1);
});

await check('library: a page with the dock, a folder opens and comes back', async page => {
  await page.click('#nav-library');
  await page.waitForSelector('#library');
  expect(await page.getAttribute('#nav-library', 'aria-current') === 'page', 'Bibliothèque current');
  expect(!(await page.locator('.lib-tile[aria-pressed="true"]').count()), 'no view looks chosen by default');
  await page.click('.lib-folder:has-text("Idées")');
  await page.waitForSelector('#page-title:has-text("Idées")');
  await page.click('.back-chip');
  await page.waitForSelector('#library');
});

await check('left hand: Gaucher puts the + on the left of the navigation', async page => {
  await page.click('#nav-settings');
  await page.getByRole('radio', { name: 'Gaucher', exact: true }).click();
  await page.click('#sheet-close');
  const fab = await page.locator('#fab').boundingBox(), nav = await page.locator('#nav-island').boundingBox();
  expect(fab.x < nav.x, `+ at ${fab.x}, navigation at ${nav.x}`);
});

await check('Quoi de neuf: reopens from Réglages with the installed version, said once', async page => {
  await page.click('#nav-settings');
  await page.getByRole('button', { name: /Quoi de neuf/ }).click();
  await page.waitForSelector('.sheet[data-mode="news"] .version-pill.is-new');
  expect(!(await page.locator('.sheet[data-mode="news"] .release').count()), 'one version: no second header repeating the summary');
  expect(await page.evaluate(() => document.querySelector('.sheet .sheet-body').scrollTop) === 0, 'opens at the top');
});

await check('phone sheet: from the bottom edge, the dock steps aside, a pull on the handle closes it', async page => {
  await page.click('#nav-settings');
  await page.waitForSelector('.sheet[data-mode="settings"]');
  const box = await page.locator('.sheet').boundingBox();
  expect(Math.abs(box.y + box.height - 844) < 2, 'sheet ends at the bottom edge: ' + (box.y + box.height));
  await page.waitForFunction(() => getComputedStyle(document.querySelector('.main-dock')).visibility === 'hidden');
  const head = await page.locator('.sheet-head h2').boundingBox();
  await page.mouse.move(head.x + 10, head.y + 10);
  await page.mouse.down();
  await page.mouse.move(head.x + 10, head.y + 70, { steps: 4 });
  await page.mouse.up();
  expect(await page.locator('.sheet[data-mode="settings"]').count() === 1, 'a short pull springs back');
  await page.waitForTimeout(300);
  await page.mouse.move(head.x + 10, head.y + 10);
  await page.mouse.down();
  await page.mouse.move(head.x + 10, head.y + 200, { steps: 6 });
  await page.mouse.up();
  await page.waitForSelector('.sheet', { state: 'detached' });
  await page.waitForFunction(() => getComputedStyle(document.querySelector('.main-dock')).visibility === 'visible');
});

await check('editor: one bar — Aa swaps the tools for formatting; templates sit in the note and go at the first letter', async page => {
  await page.click('#fab');
  await page.click('#create-note');
  await page.waitForSelector('.editor.open .starters .starter');
  const placeholder = await page.locator('textarea.editor-text').boundingBox(), starters = await page.locator('.starters').boundingBox();
  expect(starters.y > placeholder.y && starters.y < 400, 'templates under the placeholder, in the note');
  await page.click('textarea.editor-text');
  await page.getByRole('button', { name: 'Mise en forme' }).click();
  await page.waitForSelector('.format-strip');
  expect(!(await page.locator('#format-bar [aria-label="Joindre une photo, un audio ou un PDF"]').count()), 'formatting replaces the note tools');
  const rows = await page.evaluate(() => new Set([...document.querySelectorAll('#format-bar .island, #format-bar .fab')].map(e => Math.round(e.getBoundingClientRect().bottom))).size);
  expect(rows === 1, 'a single row at the bottom, got ' + rows);
  await page.keyboard.type('x');
  await page.waitForSelector('.starters', { state: 'detached' });
});

await check('pinned: a shelf on top that folds away; the other notes follow', async page => {
  await page.getByRole('button', { name: 'Actions : Comment utiliser' }).click();
  await page.getByRole('button', { name: 'Épingler', exact: true }).click();
  const shelf = page.locator('#note-list button.is-toggle:has-text("Épinglées")');
  await shelf.waitFor();
  expect(await page.locator('#note-list .list-heading:has-text("Récentes")').count() === 1, 'then the recent notes');
  await shelf.click();
  expect(await shelf.getAttribute('aria-expanded') === 'false', 'folded');
  await page.waitForFunction(() => document.querySelectorAll('#note-list .card').length === 1);
});

await check('compact list: one line per note, under its title and date', async page => {
  await page.getByRole('button', { name: 'Afficher en liste compacte' }).click();
  await page.waitForSelector('#note-list.is-compact .card-body.is-line');
  const h = await page.locator('#note-list .card').first().boundingBox();
  expect(h.height < 80, 'a compact row is short: ' + h.height);
});

await check('mouse: hovering a note offers pin, move and delete', async page => {
  await page.hover('#note-list .card:has-text("Bienvenue")');
  await page.getByRole('button', { name: 'Épingler : Bienvenue' }).click();
  await page.waitForSelector('#note-list button.is-toggle:has-text("Épinglées")');
  await page.hover('#note-list .card:has-text("Bienvenue")');
  await page.getByRole('button', { name: 'Déplacer : Bienvenue' }).click();
  await page.waitForSelector('.layer[data-mode="picker"]');
}, { viewport: { width: 1180, height: 820 }, mouse: true });

await check('tablet: Réglages in a side panel down to the dock line, the dock beside it (never under it)', async page => {
  await page.click('#nav-settings');
  await page.waitForSelector('.sheet[data-drawer][data-mode="settings"]');
  await page.waitForTimeout(500);
  const panel = await page.locator('.sheet').boundingBox(), dock = await page.locator('.main-dock .island').boundingBox(), fab = await page.locator('#fab').boundingBox();
  expect(Math.max(dock.x + dock.width, fab.x + fab.width) <= panel.x, `dock ends at ${fab.x + fab.width}, panel starts at ${panel.x}`);
  expect(Math.abs(panel.y + panel.height - (fab.y + fab.height)) < 12, 'panel and dock end on the same line');
}, { viewport: { width: 1180, height: 820 } });

await check('select with S, delete, then undo', async page => {
  await page.focus('#note-list .card-open');
  await page.keyboard.press('s');
  await page.waitForSelector('body.is-selecting');
  expect(await page.locator('.card-open[aria-pressed="true"]').count() === 1, 'the focused note is selected');
  await page.getByRole('button', { name: 'Supprimer la sélection' }).click();
  await page.waitForFunction(() => document.querySelectorAll('#note-list .card').length === 1);
  await page.getByRole('button', { name: 'Annuler', exact: true }).click();
  await page.waitForFunction(() => document.querySelectorAll('#note-list .card').length === 2);
});

await check('keyboard selection: Space ticks the focused note, Escape ends', async page => {
  await page.focus('#note-list .card-open');
  await page.keyboard.press('s');
  await page.waitForSelector('body.is-selecting');
  await page.keyboard.press('Space');
  expect(!(await page.locator('.card-open[aria-pressed="true"]').count()), 'Space unticks the note');
  await page.keyboard.press('Space');
  expect(await page.locator('.card-open[aria-pressed="true"]').count() === 1, 'Space ticks it again');
  await page.keyboard.press('Escape');
  await page.waitForSelector('body:not(.is-selecting)');
});

await check('looks: home, Créer and Réglages on a phone', async page => {
  await shot(page, 'phone-home');
  await page.click('#fab');
  await page.waitForSelector('.layer[data-mode="create"]');
  await shot(page, 'phone-create');
  await page.keyboard.press('Escape');
  await page.click('#nav-settings');
  await page.waitForSelector('.sheet[data-mode="settings"]');
  await shot(page, 'phone-settings', '.sheet[data-mode="settings"] .option small');   // the version changes every release
});

await check('looks: home in dark', async page => {
  await shot(page, 'phone-home-dark');
}, { colorScheme: 'dark' });

await check('looks: tablet, note beside the list', async page => {
  await openNote(page, 'Comment utiliser');
  await shot(page, 'tablet-note');
}, { viewport: { width: 1047, height: 586 } });

// Speech to text: the model comes from Hugging Face; ASR_MODEL=<dir with Xenova/whisper-tiny files> serves it locally, SKIP_ASR=1 skips
const voice = fileURLToPath(new URL('./fixtures/voix.wav', import.meta.url));
if (!process.env.SKIP_ASR) await check('voice text: a recording is transcribed on the device and its words are stored', async page => {
  if (process.env.ASR_MODEL) await page.context().route('https://huggingface.co/Xenova/whisper-tiny/resolve/main/**', route =>
    route.fulfill({ path: process.env.ASR_MODEL + '/' + new URL(route.request().url()).pathname.split('/resolve/main/')[1] }));
  await page.click('#nav-settings');
  await page.getByRole('switch', { name: /Texte des notes vocales/ }).click();
  await page.click('#sheet-close');
  await page.setInputFiles('#audio-input', voice);
  const t0 = Date.now();
  let text = '';
  while (Date.now() - t0 < 240000 && !/pain|lait|bonjour|demain/i.test(text)) { await page.waitForTimeout(3000); text = await idbTexts(page); }
  expect(/pain|lait|bonjour|demain/i.test(text), 'transcribed words, got: ' + JSON.stringify(text));
  notes.push('transcript: ' + text.trim().slice(0, 140));
});

await check('photo text: a photo is read on the device and its words are stored', async page => {
  await page.click('#nav-settings');
  await page.getByRole('switch', { name: /Texte dans les photos/ }).click();
  await page.click('#sheet-close');
  await page.setInputFiles('#image-input', photo);
  const t0 = Date.now();
  let text = '';
  while (Date.now() - t0 < 90000 && !/Troyes/i.test(text)) { await page.waitForTimeout(2000); text = await idbTexts(page); }
  expect(/Troyes/i.test(text), 'recognised text, got: ' + JSON.stringify(text));
});

await check('live text: with the setting off, one tap reads a photo and adds its words to the note', async page => {
  await page.setInputFiles('#image-input', photo);
  await page.waitForSelector('.editor.open .att-live');
  await page.click('.att-live');
  await page.waitForSelector('.toast:has-text("Texte ajouté")', { timeout: 90000 });
  const body = await page.evaluate(() => document.querySelector('textarea.editor-text').value);
  expect(/Troyes/i.test(body), 'the photo\'s words are in the note: ' + body.slice(0, 80));
});

await check('dark theme: dark ground from the first frame', async page => {
  const bg = await page.evaluate(() => getComputedStyle(document.documentElement).backgroundColor);
  expect(bg === 'rgb(8, 9, 12)', 'html background ' + bg);
}, { colorScheme: 'dark' });

await check('phone: the Plan closes when the note is touched', async page => {
  await openNote(page, 'Comment utiliser');
  await page.click('.note-tools .chip:has-text("Plan")');
  await page.waitForSelector('.layer[data-mode="outline"]');
  await page.mouse.click(200, 700);
  await page.waitForSelector('.layer[data-mode="outline"]', { state: 'detached' });
});

await check('tablet: note beside the list, Plan as an inspector without veil', async page => {
  await openNote(page, 'Comment utiliser');
  const pane = await page.evaluate(() => document.getElementById('editor').getBoundingClientRect().left);
  expect(pane > 300 && pane < 600, 'editor pane starts at ' + pane);
  await page.click('.note-tools .chip:has-text("Plan")');
  await page.waitForSelector('.layer[data-inspector]');
  expect(!(await page.locator('.scrim').count()), 'no veil behind the inspector');
  await page.click('#note-view', { position: { x: 12, y: 12 } });
  expect(await page.locator('.layer[data-inspector]').count() === 1, 'inspector stays while writing');
}, { viewport: { width: 1047, height: 586 } });

await browser.close();
server.httpServer.close();
for (const [s, name, why] of results) console.log(`${s.padEnd(4)} ${name}${why ? ' — ' + why : ''}`);
for (const n of notes) console.log('     ' + n);
process.exit(results.some(r => r[0] === 'FAIL') ? 1 : 0);
