/** Table blocks, without a browser: operations (merges first), selection clamping, the note block, Markdown out and in. */
import assert from 'node:assert/strict';
import {
  addCol, addRow, canMerge, clamp, createTable, cycleAlign, exportTables, importTables, isTableJson, insertTableAt, owner, parseTable, plainTables,
  removeCol, removeRow, setTableAt, setText, tableAt, toFence, toggleHead, toggleMerge,
} from '../src/table.ts';

/** Every row is as wide as the table, every merge owns exactly the cells it covers, no covered cell is left alone. */
function valid(d) {
  const w = d.align.length;
  for (const row of d.rows) {
    assert.equal(row.length, w);
    let cover = 0;
    for (let k = 0; k < w; k++) {
      const s = row[k].s ?? 1;
      if (cover) { assert.equal(s, 0, `column ${k} should be covered`); cover--; continue; }
      assert.notEqual(s, 0, `orphan covered cell at ${k}`);
      assert.ok(k + s <= w, 'merge runs past the last column');
      cover = s - 1;
    }
    assert.equal(cover, 0);
  }
  return d;
}
const texts = d => d.rows.map(r => r.map(c => c.t));
const widths = d => d.rows.map(r => r.map(c => c.s));

// 3 × 3, row 1 = "x y" merged over columns 0–1
const base = () => {
  let d = createTable(3, 3);
  d = setText(setText(d, { r: 1, c: 0 }, 'x'), { r: 1, c: 1 }, 'y');
  return valid(toggleMerge(d, { r: 1, c: 0 }));
};
const b = base();
assert.deepEqual(widths(b)[1], [2, 0, undefined]);
assert.equal(b.rows[1][0].t, 'x y');

// default table: 3 columns, 2 rows, first row is the header
{
  const d = valid(createTable());
  assert.deepEqual([d.align.length, d.rows.length, d.head], [3, 2, true]);
}

/* ---- columns through a merge (the subtle case) ---- */
{
  const d = valid(removeCol(b, 1));   // cuts the merge: it splits, the column goes
  assert.equal(d.align.length, 2);
  assert.deepEqual(widths(d)[1], [undefined, undefined]);
  assert.equal(d.rows[1][0].t, 'x y');
}
{
  const d = valid(removeCol(b, 0));   // the merge's first column: its text goes with it
  assert.equal(d.align.length, 2);
  assert.deepEqual(texts(d)[1], ['', '']);
}
{
  const d = valid(removeCol(b, 2));   // outside the merge: kept
  assert.deepEqual(widths(d)[1], [2, 0]);
}
{
  const d = valid(addCol(b, 0));      // between the merged columns: the merge splits
  assert.equal(d.align.length, 4);
  assert.ok(d.rows[1].every(c => (c.s ?? 1) === 1));
  assert.equal(d.rows[1][0].t, 'x y');
}
{
  const d = valid(addCol(b, 1));      // after the merge: kept
  assert.deepEqual(widths(d)[1], [2, 0, undefined, undefined]);
}
{
  const d = valid(addCol(b, -1));     // before the first column: the merge moves right, whole
  assert.deepEqual(widths(d)[1], [undefined, 2, 0, undefined]);
}
// a wide merge: the new column splits it into plain cells, none left covered
{
  let d = toggleMerge(toggleMerge(createTable(4, 1), { r: 0, c: 2 }), { r: 0, c: 0 });
  assert.deepEqual(widths(valid(d))[0], [2, 0, 2, 0]);
  d = valid(addCol(d, 2));
  assert.deepEqual(widths(d)[0], [2, 0, undefined, undefined, undefined]);   // the first merge is left alone
}

/* ---- rows ---- */
{
  const d = valid(addRow(b, 0));
  assert.equal(d.rows.length, 4);
  assert.deepEqual(texts(d)[1], ['', '', '']);
  assert.equal(d.rows[2][0].s, 2);    // the merge stays on its own row
  assert.equal(valid(removeRow(b, 1)).rows.length, 2);
}

/* ---- merge ---- */
{
  let d = createTable(3, 2);
  d = toggleMerge(d, { r: 0, c: 1 });
  d = valid(toggleMerge(d, { r: 0, c: 0 }));   // absorbs the merge on its right
  assert.deepEqual(widths(d)[0], [3, 0, 0]);
  assert.ok(canMerge(d, { r: 0, c: 0 }), 'a merged cell can split');
  d = valid(toggleMerge(d, { r: 0, c: 0 }));
  assert.deepEqual(widths(d)[0], [undefined, undefined, undefined]);
}
{
  const d = createTable(2, 1);
  assert.ok(!canMerge(d, { r: 0, c: 1 }), 'the last column cannot merge right');
  assert.equal(toggleMerge(d, { r: 0, c: 1 }), d);
}

/* ---- minimums, purity, header, alignment ---- */
{
  const d = createTable(1, 1);
  assert.equal(removeRow(d, 0), d);
  assert.equal(removeCol(d, 0), d);
}
{
  const snap = JSON.stringify(b);
  addCol(b, 0); removeCol(b, 1); addRow(b, 0); removeRow(b, 1); toggleMerge(b, { r: 1, c: 0 }); toggleHead(b); cycleAlign(b, 0);
  assert.equal(JSON.stringify(b), snap, 'operations never change their input');
}
assert.equal(toggleHead(createTable()).head, false);
assert.deepEqual([0, 1, 2, 3].reduce(d => cycleAlign(d, 1), createTable()).align, ['left', 'center', 'left']);
assert.equal(cycleAlign(createTable(), 0).align[0], 'center');

/* ---- selection survives structure changes ---- */
{
  const d = createTable(3, 3);
  assert.deepEqual(clamp(removeRow(d, 2), { r: 2, c: 1 }), { r: 1, c: 1 });
  assert.deepEqual(clamp(removeCol(d, 2), { r: 0, c: 2 }), { r: 0, c: 1 });
  assert.deepEqual(clamp(d, { r: 0, c: 1 }), { r: 0, c: 1 });
  const m = toggleMerge(createTable(3, 2), { r: 0, c: 0 });
  assert.deepEqual(clamp(m, { r: 0, c: 1 }), { r: 0, c: 0 }, 'a covered cell snaps to its merge');
  const w = toggleMerge(createTable(4, 2), { r: 0, c: 1 });
  assert.deepEqual(clamp(removeCol(w, 3), { r: 0, c: 3 }), { r: 0, c: 1 });
  assert.deepEqual(owner(createTable(3, 2), 1, 2), { r: 1, c: 2 });
}

/* ---- the block in a note ---- */
{
  let d = createTable(2, 2);
  d = setText(setText(d, { r: 0, c: 0 }, 'Jour'), { r: 1, c: 0 }, 'Samedi');
  const body = 'Avant\n' + toFence(d) + '\nAprès';
  const lines = body.split('\n');
  assert.deepEqual(tableAt(lines, 1), d);
  assert.equal(tableAt(lines, 0), null);
  assert.equal(setTableAt(body, 1, d), body);
  assert.equal(setTableAt(body, 1, null), 'Avant\nAprès');
  assert.equal(parseTable('{"v":1,"head":true,"align":["left"],"rows":[[{"t":"a"},{"t":"b"}]]}'), null, 'a row of the wrong width is not a table');
  assert.equal(parseTable('not json'), null);
  assert.equal(tableAt(['```notes-table', '{"v":1}', '```'], 0), null);

  // inserted on its own lines, wherever the caret was
  for (const [text, pos] of [['', 0], ['abc', 3], ['abc\n', 4], ['abc\ndef', 3], ['abc\ndef', 1]]) {
    const { value, line } = insertTableAt(text, pos);
    assert.ok(tableAt(value.split('\n'), line), `a table starts at line ${line} of ${JSON.stringify(value)}`);
    assert.equal(plainTables(setTableAt(value, line, null)).replace(/\n/g, ''), text.replace(/\n/g, ''), 'the text around it is untouched');
  }
}

/* ---- Markdown out and in ---- */
{
  let d = createTable(3, 2);
  d = setText(setText(d, { r: 0, c: 0 }, 'Nom'), { r: 0, c: 1 }, 'a|b');
  d.align = ['left', 'center', 'right'];
  const body = 'Intro\n' + toFence(d) + '\nFin';
  const md = exportTables(body);
  assert.equal(md, 'Intro\n| Nom | a\\|b |  |\n| :-- | :-: | --: |\n|  |  |  |\nFin');
  assert.equal(importTables(md), body, 'a plain table comes back as the same block');
  assert.equal(plainTables(body), 'Intro\nNom\ta|b\t\n\t\t\nFin');
}
{
  const d = toggleMerge(setText(createTable(3, 2), { r: 1, c: 0 }, 'x'), { r: 1, c: 0 });
  const body = toFence(d), md = exportTables(body);
  assert.match(md, /^<!-- notes-table \{/, 'a merge travels in a comment');
  assert.match(md, /\| x \|  \|  \|$/, 'the pipe table shows the merge as an empty cell');
  assert.equal(importTables(md), body, 'merges survive an export and an import');
}
{
  const d = { ...createTable(2, 2), head: false };
  assert.equal(importTables(exportTables(toFence(d))), toFence(d), 'a table without header keeps it that way');
}
{
  const plain = importTables('Titre\n\n| A | B |\n|:-:|--:|\n| 1 | 2 |\n| 3 |\n\nfin');
  const d = tableAt(plain.split('\n'), 2);
  assert.deepEqual(d.align, ['center', 'right']);
  assert.deepEqual(texts(d), [['A', 'B'], ['1', '2'], ['3', '']]);
  assert.ok(plain.endsWith('\n\nfin'));
}
assert.equal(importTables('a | b\nno delimiter row'), 'a | b\nno delimiter row', 'not every pipe is a table');
assert.equal(importTables('```\n| A |\n|---|\n```'), '```\n| A |\n|---|\n```', 'a table inside a code block stays text');
assert.equal(exportTables('no table here'), 'no table here');

/* ---- review findings: adjacent tables, flashcards ---- */
{
  const a = setText(createTable(2, 1), { r: 0, c: 0 }, 'A'), b2 = setText(createTable(3, 1), { r: 0, c: 0 }, 'B');
  const body = toFence(a) + '\n' + toFence(b2);
  const back = importTables(exportTables(body)).split('\n').filter(Boolean);
  assert.deepEqual([tableAt(back, 0), tableAt(back, 3)], [a, b2], 'two tables in a row survive an export and an import');
}
{
  const lines = ['x', ...toFence(setText(createTable(1, 1), { r: 0, c: 0 }, 'q :: a')).split('\n'), 'y'];
  assert.deepEqual(lines.map((_, i) => isTableJson(lines, i)), [false, false, true, false, false]);
}

console.log('ok   table: operations, merges, block, Markdown out and in');
