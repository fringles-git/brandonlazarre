import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { CURRENT } from './src/changelog';

const BUILD = new Date().toISOString().replace(/\D/g, '').slice(0, 14);
const COMMIT = (() => { try { return execSync('git rev-parse HEAD').toString().trim(); } catch { return process.env.GITHUB_SHA || ''; } })();

/** Fills the service worker's precache list with the hashed build files, stamps the build,
    and writes version.json: what the deploy checks on the live site (never cached, never precached). */
function serviceWorker(): Plugin {
  return {
    name: 'notes-sw',
    apply: 'build',
    generateBundle(_, bundle) {
      const files = Object.keys(bundle).filter(f => !f.endsWith('.map')).map(f => './' + f);
      const source = readFileSync('src/sw.js', 'utf8')
        .replace('__VERSION__', 'notes-' + BUILD)
        .replace('[/*__FILES__*/]', JSON.stringify(files));
      this.emitFile({ type: 'asset', fileName: 'sw.js', source });
      this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ version: CURRENT.version, build: BUILD, commit: COMMIT }) + '\n' });
    },
  };
}

export default defineConfig({
  base: './',
  define: { __BUILD__: JSON.stringify(BUILD), __APP_VERSION__: JSON.stringify(CURRENT.version) },
  plugins: [react(), serviceWorker()],
  build: { target: 'es2022', assetsInlineLimit: 0 },
});
