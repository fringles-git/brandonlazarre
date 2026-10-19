/**
 * Smoke test of the built app, run before every push: `npm run smoke` (builds, serves dist/, drives a real Chromium).
 * Covers the paths that must never break: first launch, create, search, Library page, photo text, dark theme,
 * menus that keep the dock, the phone Plan closing on a tap, the tablet inspector beside the note.
 * Browser: Playwright's Chromium, or CHROMIUM_PATH (+ optional CHROMIUM_ARGS) for any other build.
 */
import { preview } from 'vite';
import { chromium } from 'playwright-core';
import { fileURLToPath } from 'node:url';

const PORT = 4179, APP = `http://localhost:${PORT}/`;
const photo = fileURLToPath(new URL('./fixtures/photo-texte.png', import.meta.url));
const server = await preview({ preview: { port: PORT, strictPort: true }, logLevel: 'silent' });
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: process.env.CHROMIUM_ARGS ? process.env.CHROMIUM_ARGS.split(' ') : [],
});

const results = [];
async function check(name, run, { viewport = { width: 390, height: 844 }, colorScheme = 'light' } = {}) {
  const ctx = await browser.newContext({ viewport, colorScheme, hasTouch: true, reducedMotion: 'reduce' });
  const page = await ctx.newPage(), errors = [];
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
process.exit(results.some(r => r[0] === 'FAIL') ? 1 : 0);
