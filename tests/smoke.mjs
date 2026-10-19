/**
 * Smoke test of the built app, run before every push: `npm run smoke` (builds, serves dist/, drives a real Chromium).
 * Covers the paths that must never break: first launch, create, search, Library page, left hand, Quoi de neuf,
 * keyboard selection with undo, photo text, dark theme, the phone Plan closing on a tap, the tablet inspector.
 * Looks: a few screens are compared with reference shots in tests/shots/ (clock fixed, motion off). A change beyond
 * 0.3 % of pixels fails and leaves the diff in tests/shots/diff/; `npm run smoke -- --update-shots` accepts it.
 * References belong to the machine and Chromium that made them: SHOTS=off skips the comparison elsewhere (CI).
 * Browser: Playwright's Chromium, or CHROMIUM_PATH (+ optional CHROMIUM_ARGS) for any other build.
 */
import { preview } from 'vite';
import { chromium } from 'playwright-core';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';

const PORT = 4179, APP = `http://localhost:${PORT}/`;
const photo = fileURLToPath(new URL('./fixtures/photo-texte.png', import.meta.url));
const SHOTS = fileURLToPath(new URL('./shots/', import.meta.url)), UPDATE = process.argv.includes('--update-shots');
const notes = [];
const server = await preview({ preview: { port: PORT, strictPort: true }, logLevel: 'silent' });
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: process.env.CHROMIUM_ARGS ? process.env.CHROMIUM_ARGS.split(' ') : [],
});

const results = [];
async function check(name, run, { viewport = { width: 390, height: 844 }, colorScheme = 'light' } = {}) {
  const ctx = await browser.newContext({ viewport, colorScheme, hasTouch: true, reducedMotion: 'reduce', locale: 'fr-FR', timezoneId: 'Europe/Paris' });
  const page = await ctx.newPage(), errors = [];
  await page.clock.setFixedTime(new Date('2026-10-19T10:00:00+02:00'));   // same dates on every run, for the shots
  page.setDefaultTimeout(20000);
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => m.type() === 'error' && errors.push(m.text()));
  try {
    await page.goto(APP);
    await page.getByRole('button', { name: 'Passer', exact: true }).click();
    await page.waitForSelector('#note-list .card');
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
async function shot(page, name, mask = []) {
  if (process.env.SHOTS === 'off') return;
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(400);
  const now = await page.screenshot({ animations: 'disabled', caret: 'hide', mask: mask.map(m => page.locator(m)) }), file = SHOTS + name + '.png';
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

await check('first launch: two starter notes, Notes is the current tab', async page => {
  expect(await page.locator('#note-list .card').count() === 2, 'two starter notes');
  expect(await page.getAttribute('#nav-notes', 'aria-current') === 'page', 'Notes current');
});

await check('create: + keeps the dock, opens Créer, a note is written and listed', async page => {
  await page.click('#fab');
  await page.waitForSelector('.layer[data-mode="create"]');
  expect(await page.isVisible('#nav-island'), 'dock stays visible');
  expect(await page.getAttribute('#fab', 'aria-expanded') === 'true', '+ shows as ✕');
  await page.click('#create-note');
  await page.waitForSelector('.editor.open');
  await page.fill('.editor-title', 'Note de contrôle');
  await page.click('.editor-dock .fab');
  await page.waitForSelector('#note-list .card-open:has-text("Note de contrôle")');
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

await check('Quoi de neuf: reopens from Réglages with the installed version', async page => {
  await page.click('#nav-settings');
  await page.getByRole('button', { name: /Quoi de neuf/ }).click();
  await page.waitForSelector('.sheet[data-mode="news"] .version-pill.is-new');
});

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
  await shot(page, 'phone-settings', ['.option:has-text("Quoi de neuf") small']);   // the version changes every release
});

await check('looks: home in dark', async page => {
  await shot(page, 'phone-home-dark');
}, { colorScheme: 'dark' });

await check('looks: tablet, note beside the list', async page => {
  await openNote(page, 'Comment utiliser');
  await shot(page, 'tablet-note');
}, { viewport: { width: 1047, height: 586 } });

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
