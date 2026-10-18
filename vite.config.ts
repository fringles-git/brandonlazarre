import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';

const BUILD = new Date().toISOString().replace(/\D/g, '').slice(0, 14);

/** Fills the service worker's precache list with the hashed build files, and stamps the build. */
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
    },
  };
}

export default defineConfig({
  base: './',
  define: { __BUILD__: JSON.stringify(BUILD) },
  plugins: [react(), serviceWorker()],
  build: { target: 'es2022', assetsInlineLimit: 0 },
});
