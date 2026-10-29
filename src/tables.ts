/** Table blocks in the open note: insert one, edit it, select a cell. The note body stays the only copy (see table.ts). */
import { editNote, editorRefs, patchEditor } from './actions';
import { get, openNote } from './store';
import { clamp, insertTableAt, setTableAt, type Pos, type TableData } from './table';

const same = (a: { line: number; r: number; c: number } | null, line: number, p: Pos) => !!a && a.line === line && a.r === p.r && a.c === p.c;

export function selectCell(line: number, p: Pos) {
  if (!same(get().editor.cell, line, p)) patchEditor({ cell: { line, ...p, say: '' } });
}

/** Writes the table (null deletes it) and keeps a valid cell selected; `say` is read aloud once. */
export function changeTable(line: number, d: TableData | null, say = '', at?: Pos) {
  const n = openNote(get()), cur = get().editor.cell;
  if (!n) return;
  editNote({ body: setTableAt(n.body, line, d) });
  // a zero-width mark makes the same sentence new for the screen reader when it comes twice in a row
  const said = say && (cur?.say === say ? say + '​' : say);
  patchEditor({ cell: d ? { line, ...clamp(d, at ?? cur ?? { r: 0, c: 0 }), say: said } : null });
}

/** A 3 × 2 table at the caret (or at the end of the note), first cell ready to type in. */
export function insertTable() {
  const n = openNote(get()), el = editorRefs.body;
  if (!n || n.deleted) return;
  const writing = !get().editor.reading && !!el && document.activeElement === el;
  const { value, line } = insertTableAt(n.body, writing ? el!.selectionStart : n.body.length);
  editNote({ body: value }, { save: 'now' });
  patchEditor({ reading: true, cell: { line, r: 0, c: 0, say: 'Tableau inséré' } });
}
