/** Table blocks in the formatted view: cells you type in, and the tools panel above the note bar. Loaded when a note shows a table. */
import { useEffect, useMemo, useRef, type KeyboardEvent } from 'react';
import { openNote, useStore } from '../store';
import { patchEditor } from '../actions';
import { changeTable, selectCell } from '../tables';
import {
  ALIGN_LABEL, addCol, addRow, canMerge, cycleAlign, owner, removeCol, removeRow, setText, span, tableAt, toggleHead, toggleMerge,
  type Pos, type TableData,
} from '../table';
import { Icon } from './icons';

const ALIGN_ICON = { left: 'alignLeft', center: 'alignCenter', right: 'alignRight' } as const;
/** Scrolls the cell into view above the bottom bars (panel included), which scrollIntoView alone would leave underneath. */
function reveal(input: HTMLElement | null) {
  const dock = document.querySelector('.editor-dock');
  if (!input || !dock) return;
  input.style.scrollMarginBottom = `${Math.max(0, window.innerHeight - dock.getBoundingClientRect().top) + 8}px`;
  input.scrollIntoView({ block: 'nearest', inline: 'nearest' });
}
const label = (d: TableData, r: number, c: number) => (d.head && r === 0 ? `En-tête, colonne ${c + 1}` : `Ligne ${d.head ? r : r + 1}, colonne ${c + 1}`);

export function TableEditor({ data, line }: { data: TableData; line: number }) {
  const cell = useStore(s => s.editor.cell), table = useRef<HTMLTableElement>(null), sel = cell?.line === line ? cell : null;
  // every visible cell in reading order: where Tab and Enter go next
  const order: Pos[] = data.rows.flatMap((row, r) => row.flatMap((c, k) => (c.s === 0 ? [] : [{ r, c: k }])));

  useEffect(() => {
    if (!sel) return;
    const input = table.current?.querySelector<HTMLInputElement>(`[data-rc="${sel.r}:${sel.c}"]`);
    if (input && document.activeElement !== input) input.focus({ preventScroll: true });
    const frame = requestAnimationFrame(() => reveal(input ?? null));   // after the panel has been laid out
    return () => cancelAnimationFrame(frame);
  }, [sel?.r, sel?.c, line, data.head]);   // the header toggle moves row 0 between thead and tbody: a new input

  const onKey = (e: KeyboardEvent<HTMLInputElement>, p: Pos) => {
    if (e.nativeEvent.isComposing) return;
    const i = order.findIndex(q => q.r === p.r && q.c === p.c), input = e.currentTarget;
    const go = (q?: Pos) => {
      if (!q) return false;
      e.preventDefault();
      selectCell(line, q);
      return true;
    };
    if (e.key === 'Tab') go(order[i + (e.shiftKey ? -1 : 1)]);   // before the first or after the last cell, Tab leaves the table
    else if (e.key === 'Enter') {
      if (e.shiftKey) go(order[i - 1]);
      else if (!go(order[i + 1])) {   // Enter in the last cell opens a new row
        e.preventDefault();
        changeTable(line, addRow(data, data.rows.length - 1), 'Ligne ajoutée', { r: data.rows.length, c: 0 });
      }
    } else if (e.key === 'ArrowUp' && p.r > 0) go(owner(data, p.r - 1, p.c));
    else if (e.key === 'ArrowDown' && p.r < data.rows.length - 1) go(owner(data, p.r + 1, p.c));
    else if (e.key === 'ArrowLeft' && input.selectionStart === 0 && input.selectionEnd === 0) go(order[i - 1]);
    else if (e.key === 'ArrowRight' && input.selectionStart === input.value.length) go(order[i + 1]);
    else if (e.key === 'Escape') {   // first Escape lets go of the cell, the next one closes the note
      e.preventDefault();
      input.blur();
      patchEditor({ cell: null });
    }
  };

  const cells = (r: number) => data.rows[r].map((cellData, c) => {
    if (cellData.s === 0) return null;
    const Tag = data.head && r === 0 ? 'th' : 'td';
    return (
      <Tag key={c} scope={Tag === 'th' ? 'col' : undefined} colSpan={span(cellData)} className={'is-' + data.align[c]} data-sel={sel?.r === r && sel.c === c || undefined}>
        <input className="tbl-in" data-rc={`${r}:${c}`} value={cellData.t} aria-label={label(data, r, c)} enterKeyHint="next" autoComplete="off" autoCapitalize="sentences"
          onFocus={() => selectCell(line, { r, c })} onChange={e => changeTable(line, setText(data, { r, c }, e.target.value))} onKeyDown={e => onKey(e, { r, c })} />
      </Tag>
    );
  });
  const bodyRows = data.rows.map((_, r) => r).filter(r => !(data.head && r === 0));
  return (
    <div className="tbl-wrap" data-line={line}>
      <table className="tbl" ref={table} aria-label="Tableau">
        {data.head && <thead><tr>{cells(0)}</tr></thead>}
        <tbody>{bodyRows.map(r => <tr key={r}>{cells(r)}</tr>)}</tbody>
      </table>
    </div>
  );
}

/** Row, column, header, merge, alignment and delete, in two rows of grouped tiles. Pressing a tile never moves focus out of the cell. */
export function TablePanel() {
  const cell = useStore(s => s.editor.cell), body = useStore(s => openNote(s)?.body ?? '');
  const data = useMemo(() => (cell ? tableAt(body.split('\n'), cell.line) : null), [body, cell?.line]);
  const shown = !!cell && !!data;
  useEffect(() => {   // the panel's arrival (first load of this chunk) pushes the dock up: keep the cell above it
    if (shown) requestAnimationFrame(() => reveal(document.querySelector('#note-view [data-sel] .tbl-in')));
  }, [shown]);
  if (!cell || !data) return null;
  const { line, r, c } = cell, merged = span(data.rows[r][c]) > 1, align = data.align[c];
  const run = (d: TableData | null, say: string, at: Pos = { r, c }) => changeTable(line, d, say, at);
  const tool = (icon: string, text: string, onClick: () => void, o: { aria?: string; pressed?: boolean; disabled?: boolean; danger?: boolean } = {}) => (
    <button type="button" className={'tbl-tool' + (o.danger ? ' is-danger' : '')} onClick={onClick} aria-label={o.aria} aria-pressed={o.pressed} disabled={o.disabled}>
      <Icon name={icon} /><span aria-hidden={o.aria ? true : undefined}>{text}</span>
    </button>
  );
  return (
    <div className="table-tools island glass" role="group" aria-label="Outils du tableau" onPointerDown={e => e.preventDefault()}>
      <div className="table-tools-row">
        <div className="tbl-group">
          {tool('tableRowAdd', 'Ligne +', () => run(addRow(data, r), 'Ligne ajoutée', { r: r + 1, c }), { aria: 'Ajouter une ligne' })}
          {tool('tableRowRemove', 'Ligne −', () => run(removeRow(data, r), 'Ligne supprimée'), { aria: 'Supprimer la ligne', disabled: data.rows.length < 2 })}
        </div>
        <div className="tbl-group">
          {tool('tableColAdd', 'Col. +', () => run(addCol(data, c + span(data.rows[r][c]) - 1), 'Colonne ajoutée', { r, c: c + span(data.rows[r][c]) }), { aria: 'Ajouter une colonne' })}
          {tool('tableColRemove', 'Col. −', () => run(removeCol(data, c), 'Colonne supprimée'), { aria: 'Supprimer la colonne', disabled: data.align.length < 2 })}
        </div>
      </div>
      <div className="table-tools-row">
        <div className="tbl-group">
          {tool('tableHead', 'En-tête', () => run(toggleHead(data), data.head ? 'En-tête retiré' : 'En-tête activé'), { aria: 'Ligne d’en-tête', pressed: data.head })}
          {tool('tableMerge', 'Fusion', () => run(toggleMerge(data, { r, c }), merged ? 'Cellules séparées' : 'Cellules fusionnées'),
            { aria: merged ? 'Séparer les cellules' : 'Fusionner avec la cellule de droite', pressed: merged, disabled: !canMerge(data, { r, c }) })}
          {tool(ALIGN_ICON[align], 'Aligner', () => { const d = cycleAlign(data, c); run(d, 'Colonne alignée ' + ALIGN_LABEL[d.align[c]]); },
            { aria: `Aligner la colonne, actuellement ${ALIGN_LABEL[align]} : changer` })}
        </div>
        <div className="tbl-group is-danger">{tool('trash', 'Suppr.', () => run(null, 'Tableau supprimé'), { aria: 'Supprimer le tableau', danger: true })}</div>
      </div>
      <span className="visually-hidden" role="status" aria-live="polite">{cell.say}</span>
    </div>
  );
}
