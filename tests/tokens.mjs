/** Depth comes from the --z-* scale in tokens.css only: a z-index written as a number anywhere else fails the smoke run. */
import fs from 'node:fs/promises';

const dir = new URL('../src/', import.meta.url);
const files = (await fs.readdir(dir, { recursive: true })).filter(f => /\.(css|tsx?)$/.test(f) && !f.endsWith('tokens.css'));
const found = [];
for (const f of files) {
  (await fs.readFile(new URL(f, dir), 'utf8')).split('\n').forEach((line, i) => {
    if (/z-?index["']?\s*:\s*["']?-?\d/i.test(line)) found.push(`src/${f}:${i + 1}  ${line.trim().slice(0, 100)}`);
  });
}
if (found.length) {
  console.error('z-index outside the --z-* scale (tokens.css):\n' + found.join('\n'));
  process.exit(1);
}
console.log(`ok   tokens: no z-index outside the --z-* scale (${files.length} files)`);
