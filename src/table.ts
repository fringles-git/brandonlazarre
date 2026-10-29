/** Table blocks: model, edit operations, and the Markdown they travel in. Pure functions, no DOM.
 * In a note a table is a three-line fenced block holding one line of JSON (the source of truth, merges included):
 *   ```notes-table
 *   {"v":1,"head":true,"align":["left"],"rows":[[{"t":""}]]}
 *   ```
 * Exported Markdown carries it as a GFM pipe table; a merge or a header-less table adds a comment with the JSON,
 * so exporting and importing again loses nothing. */

export type Align = 'left' | 'center' | 'right';
/** s = columns covered by a merge (absent = 1); s = 0 marks a cell hidden under the merge on its left. */
export interface Cell { t: string; s?: number }
export interface TableData { v: 1; head: boolean; align: Align[]; rows: Cell[][] }
export interface Pos { r: number; c: number }

export const FENCE = '```notes-table';
const CLOSE = '```';
const ALIGNS: Align[] = ['left', 'center', 'right'];
export const ALIGN_LABEL: Record<Align, string> = { left: 'à gauche', center: 'au centre', right: 'à droite' };
const DELIM: Record<Align, string> = { left: ':--', center: ':-:', right: '--:' };

const blank = (): Cell => ({ t: '' });
export const span = (c: Cell) => c.s ?? 1;
const clone = (d: TableData): TableData => ({ ...d, align: [...d.align], rows: d.rows.map(r => r.map(c => ({ ...c }))) });

export function createTable(cols = 3, rows = 2): TableData {
  return { v: 1, head: true, align: Array<Align>(cols).fill('left'), rows: Array.from({ length: rows }, () => Array.from({ length: cols }, blank)) };
}

/** The visible cell that holds column c of row r (a covered cell answers with its merge's first cell). */
export function owner(d: TableData, r: number, c: number): Pos {
  let k = c;
  while (k > 0 && d.rows[r][k].s === 0) k--;
  return { r, c: k };
}
/** Keeps a selection inside the table after rows or columns disappeared. */
export const clamp = (d: TableData, p: Pos): Pos => owner(d, Math.min(p.r, d.rows.length - 1), Math.min(p.c, d.align.length - 1));

function unmerge(row: Cell[], c: number) {
  const n = span(row[c]);
  row[c] = { t: row[c].t };
  for (let k = c + 1; k < c + n; k++) row[k] = blank();
}
/** Splits every merge for which hit(first column, width) holds. */
function split(d: TableData, hit: (at: number, n: number) => boolean) {
  for (const row of d.rows) for (let k = 0; k < row.length; k++) if (span(row[k]) > 1 && hit(k, span(row[k]))) unmerge(row, k);
}

export function setText(d: TableData, p: Pos, t: string): TableData {
  const n = clone(d);
  n.rows[p.r][p.c].t = t;
  return n;
}
export function addRow(d: TableData, after: number): TableData {
  const n = clone(d);
  n.rows.splice(after + 1, 0, Array.from({ length: n.align.length }, blank));
  return n;
}
export function removeRow(d: TableData, at: number): TableData {
  if (d.rows.length < 2) return d;
  const n = clone(d);
  n.rows.splice(at, 1);
  return n;
}
/** after = -1 inserts before the first column; a merge the new column cuts through is split first. */
export function addCol(d: TableData, after: number): TableData {
  const n = clone(d);
  split(n, (at, w) => at <= after && after + 1 < at + w);
  n.align.splice(after + 1, 0, 'left');
  for (const row of n.rows) row.splice(after + 1, 0, blank());
  return n;
}
/** Every merge that covers the removed column is split first. */
export function removeCol(d: TableData, at: number): TableData {
  if (d.align.length < 2) return d;
  const n = clone(d);
  split(n, (o, w) => o <= at && at < o + w);
  n.align.splice(at, 1);
  for (const row of n.rows) row.splice(at, 1);
  return n;
}
export const toggleHead = (d: TableData): TableData => ({ ...clone(d), head: !d.head });
export function cycleAlign(d: TableData, c: number): TableData {
  const n = clone(d);
  n.align[c] = ALIGNS[(ALIGNS.indexOf(n.align[c]) + 1) % ALIGNS.length];
  return n;
}
export const canMerge = (d: TableData, p: Pos) => span(d.rows[p.r][p.c]) > 1 || p.c + 1 < d.align.length;
/** Fusion: joins the cell with its right neighbour (taking over a merge there); on a merged cell, splits it back. */
export function toggleMerge(d: TableData, p: Pos): TableData {
  const n = clone(d), row = n.rows[p.r], j = p.c + 1;
  if (span(row[p.c]) > 1) { unmerge(row, p.c); return n; }
  if (j >= row.length) return d;
  const w = span(row[j]);
  row[p.c] = { t: [row[p.c].t, row[j].t].filter(Boolean).join(' '), s: 1 + w };
  for (let k = j; k < j + w; k++) row[k] = { t: '', s: 0 };
  return n;
}

/* ---------- The block inside a note body ---------- */
/** Parses the JSON line; anything that is not a well-formed table (a damaged or foreign note) is not one. */
export function parseTable(json: string): TableData | null {
  try {
    const d = JSON.parse(json), w = d?.align?.length;
    const ok = d?.v === 1 && typeof d.head === 'boolean' && w > 0 && d.align.every((a: unknown) => ALIGNS.includes(a as Align))
      && Array.isArray(d.rows) && d.rows.length > 0
      && d.rows.every((r: unknown) => Array.isArray(r) && r.length === w && r.every((c: Cell) => typeof c?.t === 'string' && (c.s === undefined || c.s >= 0)));
    return ok ? d : null;
  } catch { return null; }
}
/** The table whose block starts at lines[i] (three lines long), or null. */
export const tableAt = (lines: string[], i: number): TableData | null => (lines[i] === FENCE && lines[i + 2] === CLOSE ? parseTable(lines[i + 1]) : null);
/** True for the JSON line in the middle of a table block. */
export const isTableJson = (lines: string[], i: number) => lines[i - 1] === FENCE && lines[i + 1] === CLOSE && !!parseTable(lines[i]);
export const toFence = (d: TableData) => [FENCE, JSON.stringify(d), CLOSE].join('\n');

/** Replaces the block at `line` (null removes it). */
export function setTableAt(body: string, line: number, d: TableData | null) {
  const lines = body.split('\n');
  lines.splice(line, 3, ...(d ? toFence(d).split('\n') : []));
  return lines.join('\n');
}
/** Puts a new table on its own lines at `pos`; `line` is where its block starts. */
export function insertTableAt(body: string, pos: number, d = createTable()) {
  const before = body.slice(0, pos), lead = before === '' || before.endsWith('\n') ? '' : '\n';
  return { value: before + lead + toFence(d) + '\n' + body.slice(pos), line: (before + lead).split('\n').length - 1 };
}

function mapTables(body: string, fn: (d: TableData) => string, apart = false) {
  if (!body.includes(FENCE)) return body;
  const lines = body.split('\n'), out: string[] = [];
  let last = -2;   // index in `lines` of the last block's closing fence
  for (let i = 0; i < lines.length; i++) {
    const d = tableAt(lines, i);
    if (d) {
      if (apart && last === i - 1) out.push('');   // two pipe tables in a row would read back as one
      out.push(fn(d));
      i += 2;
      last = i;
    } else out.push(lines[i]);
  }
  return out.join('\n');
}
/** The words of the tables only: for search, word counts and plain text. */
export const plainTables = (body: string) => mapTables(body, d => d.rows.map(r => r.filter(c => c.s !== 0).map(c => c.t).join('\t')).join('\n'));

/* ---------- Markdown (GFM pipe tables) ---------- */
const META = new RegExp('^<!-- ' + FENCE.slice(3) + ' (.+) -->$');
const DELIM_CELL = /^:?-+:?$/;
const esc = (s: string) => s.replace(/\|/g, '\\|');
const row = (cells: string[]) => `| ${cells.join(' | ')} |`;
const lossy = (d: TableData) => !d.head || d.rows.some(r => r.some(c => c.s !== undefined && c.s !== 1));

/** Pipe table; merged cells keep their text in the first cell. */
export function toMarkdown(d: TableData) {
  const text = d.rows.map(r => r.map(c => (c.s === 0 ? '' : esc(c.t)))), [first, ...rest] = d.head ? text : [d.align.map(() => ''), ...text];
  return [...(lossy(d) ? ['<!-- ' + FENCE.slice(3) + ' ' + JSON.stringify(d).replace(/-->/g, '--\\u003e') + ' -->'] : []),
    row(first), row(d.align.map(a => DELIM[a])), ...rest.map(row)].join('\n');
}
export const exportTables = (body: string) => mapTables(body, toMarkdown, true);

function splitRow(line: string) {
  let t = line.trim();
  if (t.startsWith('|')) t = t.slice(1);
  if (t.endsWith('|') && !t.endsWith('\\|')) t = t.slice(0, -1);
  const out: string[] = [];
  let cur = '';
  for (let i = 0; i < t.length; i++) {
    if (t[i] === '\\' && t[i + 1] === '|') { cur += '|'; i++; }
    else if (t[i] === '|') { out.push(cur.trim()); cur = ''; }
    else cur += t[i];
  }
  return [...out, cur.trim()];
}
/** A header row and its delimiter row at lines[i], then body rows: the table and the line after it. */
function pipeTable(lines: string[], i: number) {
  if (!lines[i]?.includes('|') || lines[i + 1] === undefined) return null;
  const head = splitRow(lines[i]), del = splitRow(lines[i + 1]);
  if (del.length !== head.length || !del.every(c => DELIM_CELL.test(c))) return null;
  let end = i + 2;
  while (end < lines.length && lines[end].trim() && lines[end].includes('|')) end++;
  const fit = (r: string[]): Cell[] => head.map((_, k) => ({ t: r[k] ?? '' }));
  const align = del.map((c): Align => (c.startsWith(':') && c.endsWith(':') ? 'center' : c.endsWith(':') ? 'right' : 'left'));
  return { data: { v: 1, head: true, align, rows: [fit(head), ...lines.slice(i + 2, end).map(l => fit(splitRow(l)))] } as TableData, end };
}
/** Markdown in: every pipe table becomes a block (the comment's JSON wins when it comes right before one). */
export function importTables(md: string) {
  if (!md.includes('|')) return md;
  const lines = md.split('\n'), out: string[] = [];
  let code = false;
  for (let i = 0; i < lines.length; i++) {
    if (/^\s*(```|~~~)/.test(lines[i])) code = !code;
    const meta = code ? null : META.exec(lines[i]), at = meta ? i + 1 : i, found = code ? null : pipeTable(lines, at);
    if (!found) { out.push(lines[i]); continue; }
    const exact = meta ? parseTable(meta[1].replace(/--\\u003e/g, '-->')) : null;
    out.push(toFence(exact && exact.align.length === found.data.align.length ? exact : found.data));
    i = found.end - 1;
  }
  return out.join('\n');
}
