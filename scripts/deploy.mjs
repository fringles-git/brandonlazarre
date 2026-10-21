#!/usr/bin/env node
/**
 * Deploys Notes v3: test → build → publish dist/ on the notes-v3-site branch → wait until the live site serves it.
 * Hostinger pulls notes-v3-site into brandonlazarre.fr/notes-v3 on every push to it (GitHub webhook), so publishing is a push.
 * The same command runs on a laptop, in a Claude session and in GitHub Actions (.github/workflows/deploy.yml).
 *
 *   npm run deploy                          the current commit of notes-v3: clean tree, same as GitHub, smoke test green
 *   npm run deploy -- --skip-tests          emergency: build without the smoke test
 *   npm run deploy -- --prebuilt            publish dist/ as it is (CI, right after `npm run smoke` on the same commit)
 *   npm run deploy -- --rollback 26.10.19.8 publish an earlier build again (a version, or a notes-v3-site commit) — no force-push
 *   npm run deploy -- --no-verify           don't wait for the live site (no network to it from here)
 *   npm run deploy -- --dry-run             everything but the push: shows the build commit it would publish
 *   npm run deploy -- --any-branch          put another branch than notes-v3 live (on purpose, rarely)
 * Env: DEPLOY_TRAILERS — lines appended to the build commit message (e.g. Co-Authored-By).
 */
import { execFileSync, execSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const SITE = 'https://notes-v3.brandonlazarre.fr', SOURCE = 'notes-v3', TARGET = 'notes-v3-site';
const args = process.argv.slice(2), flag = f => args.includes(f), value = f => args[args.indexOf(f) + 1];
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const git = (...a) => execFileSync('git', a, { cwd: root, encoding: 'utf8', stdio: 'pipe' }).trim();
const step = s => console.log('\n▸ ' + s);
const fail = s => { console.error('\n✗ ' + s); process.exit(1); };

/** Publishes a tree on notes-v3-site as one new commit on top of it (fast-forward only: a concurrent deploy makes this one stop). */
const fetchTarget = () => git('fetch', '-q', 'origin', `+refs/heads/${TARGET}:refs/remotes/origin/${TARGET}`);
function publish(fill, message) {
  fetchTarget();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'notes-site-'));
  try {
    git('worktree', 'add', '-q', '--detach', dir, 'origin/' + TARGET);
    const g = (...a) => execFileSync('git', a, { cwd: dir, encoding: 'utf8' }).trim();
    g('rm', '-rq', '--ignore-unmatch', '.');
    fill(dir);
    g('add', '-A');
    if (!g('status', '--porcelain')) return console.log('  notes-v3-site already holds this build: nothing to publish.');
    let who = ['-c', 'user.name=Notes deploy', '-c', 'user.email=deploy@brandonlazarre.fr'];   // only when git has no identity here
    try { if (g('config', 'user.email')) who = []; } catch { /* unset */ }
    execFileSync('git', [...who, 'commit', '-q', '-F', '-'], { cwd: dir, input: message + (process.env.DEPLOY_TRAILERS ? '\n\n' + process.env.DEPLOY_TRAILERS : '') + '\n' });
    if (flag('--dry-run')) return console.log(g('show', '--stat', '--format=%s%n%n%b', 'HEAD') + '\n  --dry-run: not pushed.');
    g('push', '-q', 'origin', 'HEAD:' + TARGET);
    console.log('  pushed ' + g('rev-parse', '--short', 'HEAD') + ' to ' + TARGET);
  } finally {
    try { git('worktree', 'remove', '--force', dir); } catch { fs.rmSync(dir, { recursive: true, force: true }); }
  }
}

/** Waits until the live site's version.json reports this build (Hostinger pulls within seconds; 5 minutes at most). */
async function verify(build) {
  if (flag('--dry-run') || flag('--no-verify')) return console.log('  skipped: check ' + SITE + '/version.json');
  let seen = '';
  for (let i = 0; i < 30; i++) {
    try {
      const r = await fetch(`${SITE}/version.json?t=${Date.now()}`, { cache: 'no-store' });
      seen = r.ok ? (await r.json()).build : 'HTTP ' + r.status;
      if (seen === build) return console.log(`  live: build ${build} ✓`);
    } catch (e) { seen = e.cause?.code || e.message; }
    console.log(`  live: ${seen || 'nothing yet'}, waiting for ${build}…`);
    await new Promise(r => setTimeout(r, 10000));
  }
  fail(`${SITE} still serves "${seen}" after 5 minutes, not ${build}. Check the Hostinger Git deployment (brandonlazarre.fr › Git › notes-v3-site → notes-v3) and its GitHub webhook.`);
}

/* ---------- Rollback: an earlier build, as a new commit (history stays, nothing is force-pushed) ---------- */
if (flag('--rollback')) {
  const want = value('--rollback') || fail('--rollback needs a version (26.10.19.8) or a notes-v3-site commit');
  fetchTarget();
  const sha = /^[0-9a-f]{7,40}$/.test(want) ? git('rev-parse', want + '^{commit}')
    : git('log', 'origin/' + TARGET, '--format=%H %s').split('\n').find(l => l.slice(41) === 'Build ' + want)?.slice(0, 40);
  if (!sha) fail(`no build "${want}" on ${TARGET} (git log origin/${TARGET} --oneline lists them)`);
  step(`Publishing ${git('log', '-1', '--format=%s', sha)} (${sha.slice(0, 7)}) again`);
  publish(dir => execFileSync('git', ['checkout', sha, '--', '.'], { cwd: dir }), `Rollback to ${git('log', '-1', '--format=%s', sha)}\n\nSame files as ${TARGET}@${sha.slice(0, 7)}.`);
  let old = null;
  try { old = JSON.parse(git('show', sha + ':version.json')); } catch { /* builds before 26.10.21.1 have no version.json */ }
  step('Waiting for the live site');
  if (old) await verify(old.build); else console.log('  this build predates version.json: check the site by hand.');
  process.exit(0);
}

/* ---------- Deploy the current commit ---------- */
step('Checking the source');
if (git('status', '--porcelain')) fail('uncommitted changes: commit (and push) first — a deploy is always a commit on GitHub.');
const branch = process.env.GITHUB_REF_NAME || git('branch', '--show-current');
if (branch !== SOURCE && !flag('--any-branch')) fail(`on "${branch || 'a detached HEAD'}", not ${SOURCE} (--any-branch puts it live anyway).`);
const head = git('rev-parse', 'HEAD'), remote = git('ls-remote', 'origin', 'refs/heads/' + branch).split(/\s/)[0];
if (remote !== head) {
  if (process.env.CI) { console.log(`  ${branch} moved on to ${remote.slice(0, 7)}: that newer run deploys. Nothing to do.`); process.exit(0); }
  fail(`HEAD ${head.slice(0, 7)} is not origin/${branch} (${remote.slice(0, 7)}): push or pull first.`);
}
console.log(`  ${branch} @ ${head.slice(0, 7)} — ${git('log', '-1', '--format=%s', head).slice(0, 80)}`);

if (flag('--prebuilt')) step('Using dist/ as built by the tests');
else if (flag('--skip-tests')) { step('Building (tests skipped)'); execSync('npm run build', { cwd: root, stdio: 'inherit' }); }
else { step('Testing (npm run smoke builds dist/ and drives it in Chromium)'); execSync('npm run smoke', { cwd: root, stdio: 'inherit' }); }

const dist = path.join(root, 'dist'), info = JSON.parse(fs.readFileSync(path.join(dist, 'version.json'), 'utf8'));
if (info.commit !== head) fail(`dist/ was built from ${String(info.commit).slice(0, 7)}, not ${head.slice(0, 7)}: rebuild (drop --prebuilt).`);

step(`Publishing ${info.version} (build ${info.build}) on ${TARGET}`);
publish(dir => fs.cpSync(dist, dir, { recursive: true }),
  `Build ${info.version}\n\nFrom ${branch} @ ${head.slice(0, 7)}: ${git('log', '-1', '--format=%s', head)}` +
  (process.env.GITHUB_RUN_ID ? `\n${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}` : ''));

step('Waiting for the live site');
await verify(info.build);
console.log(flag('--dry-run') ? '\n✓ Dry run: tested and ready, nothing published.'
  : `\n✓ ${SITE} — Notes ${info.version}. Open copies offer “Nouvelle version disponible · Recharger”.`);
