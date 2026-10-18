/** Header, info pills and the note list (cards or rows, pinned shelf, search days, masonry, paging). */
import { Fragment, memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { Note } from '../types';
import { CONFIG } from '../config';
import { checkStats, dueCards, plainText, snippet } from '../markdown';
import { firstAtt, urlOf } from '../media';
import { countIn, folderColor, inTrash, tabFolder, tabLabel, useStore, visibleNotes } from '../store';
import { changePin, clearByFilter, emptyTrash, goHome, open, openLayer, openNoteMenu, openSheet, toggleCardCheck, toggleSelected } from '../actions';
import { backupDue, currentHint, dismissHint, exportBackup, playCard } from '../features';
import { consumeClick } from '../gestures';
import { bytes, clock, daysAgo, dayTime, finePointer, plural, relativeDay } from '../utils';
import { FolderTag, Formatted, Highlight } from './kit';
import { Icon } from './icons';

export function Header() {
  const count = useStore(s => visibleNotes(s).length);
  const s = useStore(useShallow(s => ({ tab: s.prefs.tab, colors: s.folderColors, query: s.query, trash: inTrash(s), selecting: s.selecting, prefs: s.prefs })));
  const title = s.tab === 'all' ? 'Notes' : tabLabel(s.tab), folder = tabFolder(s.tab);
  const changed = s.prefs.sort !== 'updated' || s.prefs.dir !== 'desc' || s.prefs.by !== 'all';
  return (
    <header className="app-header" id="app-header">
      <div className="pull-hint" aria-hidden="true"><Icon name="search" /><span>Rechercher</span></div>
      <div className="header-bar">
        {s.tab !== 'all' && <button className="back-chip glass" onClick={goHome} aria-label="Toutes les notes"><Icon name="back" /><span>Notes</span></button>}
        <h1 id="page-title" data-color={folder ? folderColor(folder, s.colors) : undefined} onClick={goHome}>
          {title}<span className="title-count" aria-hidden="true">{count}</span>
        </h1>
        <button className={'icon-btn glass' + (changed ? ' has-dot' : '')} id="view-button" onClick={() => openLayer('view')}
          aria-haspopup="dialog" aria-label={'Affichage : vue, tri, filtre, sélection' + (changed ? ' (modifié)' : '')} disabled={s.selecting}>
          <Icon name="more" />
        </button>
      </div>
      <span className="visually-hidden" aria-live="polite">
        {(s.trash ? plural(count, 'note supprimée', 'notes supprimées') : plural(count, 'note', 'notes')) + (s.query.trim() ? ' · résultats de recherche' : '')}
      </span>
    </header>
  );
}

export function InfoBar() {
  const s = useStore(useShallow(s => ({
    by: s.prefs.by, tab: s.prefs.tab, lastBackup: s.prefs.lastBackup, selecting: s.selecting, query: s.query, unlocked: s.hiddenUnlocked,
    trashCount: inTrash(s) ? countIn(s, 'trash') : 0,
    hint: s.prefs.tab === 'all' && !s.selecting && !s.searchOpen ? currentHint(s.prefs, finePointer()) : null,
    ios: s.install.ios && !s.install.standalone && !s.prefs.iosInstallDismissed && !s.memOnly && s.prefs.tab === 'all',
    backup: backupDue(s) && s.prefs.tab === 'all' && !s.selecting && !s.searchOpen,
  })));
  const by = s.by === 'me' ? 'Créé par moi' : 'Créé avec l’IA';
  const pills = [
    s.by !== 'all' && <button key="by" className="pill" onClick={clearByFilter} aria-label={'Retirer le filtre ' + by}>Filtre : {by} ✕</button>,
    s.trashCount > 0 && <button key="trash" className="pill danger" onClick={emptyTrash}>Vider la corbeille ({s.trashCount})</button>,
    /^[ftc]:/.test(s.tab) && !s.selecting && !s.query.trim() && <button key="ov" className="pill" onClick={() => openSheet('overview')}>Vue d’ensemble</button>,
    s.backup && <button key="backup" className="pill" onClick={exportBackup}>
      {s.lastBackup ? `Dernière sauvegarde il y a ${daysAgo(s.lastBackup)} jours. Exporter` : 'Aucune sauvegarde. Exporter les notes'}
    </button>,
    s.hint && <button key="hint" className="pill" onClick={() => dismissHint(s.hint!.id)} aria-label={'Masquer l’astuce : ' + s.hint.text}>{s.hint.text} ✕</button>,
    s.tab === 'locked' && s.unlocked && <button key="pin" className="pill" onClick={changePin}>Changer le code PIN</button>,
    s.ios && <button key="ios" className="pill" onClick={() => openLayer('ios-install')}>Protéger mes notes sur iPhone</button>,
  ].filter(Boolean);
  return pills.length ? <div className="info-bar">{pills}</div> : null;
}

/* ---------- Card ---------- */
function Wave({ noteId, att }: { noteId: number; att: NonNullable<ReturnType<typeof firstAtt>> }) {
  const player = useStore(s => (s.player.id === noteId ? s.player : null)), dur = att.duration || 0;
  const progress = player && dur ? player.time / dur : 0, peaks = att.peaks || Array(CONFIG.wavePeaks).fill(0);
  return (
    <>
      <button className="wave-play" onClick={() => playCard(noteId, urlOf(att))} aria-label={player?.playing ? 'Pause' : 'Lire l’audio'}>
        <Icon name={player?.playing ? 'pause' : 'play'} />
      </button>
      <span className={'wave' + (player?.playing ? ' is-playing' : '')} aria-hidden="true">
        {peaks.map((p, i) => <i key={i} className={player && i < progress * peaks.length ? 'played' : undefined} style={{ '--h': Math.round(p * 100) + '%' } as React.CSSProperties} />)}
      </span>
      <span className="wave-time">{player ? clock(Math.floor(player.time)) : dur ? clock(Math.round(dur)) : ''}</span>
    </>
  );
}
export const pdfMeta = (a: { pages?: number; size?: number }) => [a.pages && plural(a.pages, 'page', 'pages'), bytes(a.size || 0)].filter(Boolean).join(' · ');

function CardMedia({ note }: { note: Note }) {
  const [broken, setBroken] = useState(false), img = firstAtt(note, 'image'), audio = firstAtt(note, 'audio'), pdf = firstAtt(note, 'pdf');
  if (note.locked || !(img || audio || pdf)) return null;
  if (img) return <div className={'card-media card-photo' + (broken ? ' is-broken' : '')}><img src={urlOf(img)} alt="" loading="lazy" onError={() => setBroken(true)} /><Icon name="image" /></div>;
  if (audio) return <div className="card-media card-wave"><Wave noteId={note.id} att={audio} /></div>;
  return <div className="card-media card-pdf"><Icon name="doc" /><span className="pdf-name">{pdf!.name || 'Document PDF'}</span><span className="pdf-meta">{pdfMeta(pdf!)}</span></div>;
}

function match(n: Note, query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return null;
  const text = plainText(n.body), at = text.toLowerCase().indexOf(q);
  if (at > -1) return at > 80 ? { text: snippet(text, at, q.length), source: null } : null;
  const a = n.atts.find(x => x.text?.toLowerCase().includes(q));
  return a ? { text: snippet(a.text!, a.text!.toLowerCase().indexOf(q), q.length), source: a.type } : null;
}
function CardBody({ note, readable, query }: { note: Note; readable: boolean; query: string }) {
  if (!readable) return <div className="card-body"><i>Contenu masqué</i></div>;
  const m = match(note, query);
  if (m) return <div className="card-body is-snippet">{m.source && <><span className="snippet-source">{m.source === 'pdf' ? 'Dans le PDF' : 'Dans la photo'}</span> </>}<Highlight text={m.text} query={query} /></div>;
  return note.body ? <div className="card-body"><Formatted body={note.body} query={query} onToggle={(l, on) => toggleCardCheck(note.id, l, on)} /></div> : null;
}
const Count = ({ icon, text, spoken, className = '' }: { icon: string; text: string; spoken: string; className?: string }) => (
  <span className={'count ' + className}><Icon name={icon} /><span aria-hidden="true">{text}</span><span className="visually-hidden">{spoken}</span></span>
);
function CardFooter({ note }: { note: Note }) {
  if (note.locked) return null;
  const { done, total } = checkStats(note.body), due = dueCards(note).length, remind = !!note.remind && !note.remindDone;
  const items = [
    note.atts.length > 0 && <Count key="a" icon="attach" text={String(note.atts.length)} spoken={plural(note.atts.length, 'pièce jointe', 'pièces jointes')} />,
    total > 0 && <Count key="l" icon="checklist" text={`${done}/${total}`} spoken={`${done} sur ${total} cochés`} className={done === total ? 'is-done' : ''} />,
    due > 0 && <Count key="d" icon="study" text={String(due)} spoken={plural(due, 'carte à réviser', 'cartes à réviser')} />,
    remind && <Count key="r" icon="bell" text={dayTime(note.remind!)} spoken={'Rappel ' + dayTime(note.remind!)} />,
    note.by === 'ai' && <span key="ai" className="count">IA</span>,
  ].filter(Boolean);
  return items.length ? <div className="card-footer">{items}</div> : null;
}

interface CardProps {
  note: Note; inShelf: boolean; grip: boolean; selected: boolean; selecting: boolean; isOpen: boolean; readable: boolean;
  query: string; color: number | null; date: number; showFolder: boolean;
}
const Card = memo(function Card({ note, inShelf, grip, selected, selecting, isOpen, readable, query, color, date, showFolder }: CardProps) {
  const title = note.title || 'Sans titre';
  return (
    <article className={'card' + (selected ? ' selected' : '') + (grip ? ' has-grip' : '') + (isOpen ? ' is-open' : '')}
      data-id={note.id} data-color={color ?? undefined} data-pinned={note.pinned || undefined}>
      <span className="card-check" aria-hidden="true"><Icon name="check" /></span>
      {grip && <span className="card-grip" aria-hidden="true" title="Glisser pour réordonner"><Icon name="grip" /></span>}
      <CardMedia note={note} />
      <div className="card-head">
        <h3 className="card-title">
          <button className="card-open" aria-pressed={selecting ? selected : undefined}
            onClick={() => { if (consumeClick()) return; if (selecting) toggleSelected(note.id); else open(note.id); }}>
            <Highlight text={title} query={query} />
          </button>
        </h3>
        {!selecting && <button className="card-more" onClick={() => openNoteMenu(note.id)} aria-label={'Actions : ' + title} aria-haspopup="dialog"><Icon name="more" /></button>}
      </div>
      <p className="card-meta">
        {note.pinned && !inShelf && <><Icon name="pin" /><span className="visually-hidden">Épinglée. </span></>}
        {note.locked && <><Icon name="lock" /><span className="visually-hidden">Masquée. </span></>}
        <span>{relativeDay(date)}</span>
        {showFolder && note.folder && <FolderTag folder={note.folder} />}
      </p>
      <CardBody note={note} readable={readable} query={query} />
      <CardFooter note={note} />
    </article>
  );
});

function Empty() {
  const filtered = useStore(s => !!s.query.trim() || !!s.searchKind || s.prefs.by !== 'all'), trash = useStore(inTrash);
  return <div className="empty">{filtered ? 'Aucune note ne correspond.' : trash ? 'Corbeille vide.' : 'Aucune note. Touchez + pour écrire la première.'}</div>;
}

const dayGroup = (t: number) => {
  const n = daysAgo(t);
  return n <= 0 ? 'Aujourd’hui' : n < 7 ? 'Cette semaine' : n < 30 ? 'Ce mois-ci' : 'Plus tôt';
};

/** CSS grid masonry: each card spans as many 1px rows as it is tall. */
function useMasonry(list: React.RefObject<HTMLElement | null>, on: boolean, deps: unknown[]) {
  useLayoutEffect(() => {
    const el = list.current;
    if (!el) return;
    const items = [...el.children] as HTMLElement[];
    if (!on || !window.ResizeObserver) return void items.forEach(c => c.style.removeProperty('grid-row-end'));
    const row = parseFloat(getComputedStyle(el).gridAutoRows) || 1, gap = (items.length && parseFloat(getComputedStyle(items[0]).marginBottom)) || 0;
    const fit = (cards: HTMLElement[]) => cards.forEach(c => {
      const span = 'span ' + Math.max(1, Math.ceil((c.offsetHeight + gap) / row));
      if (c.style.gridRowEnd !== span) c.style.gridRowEnd = span;
    });
    fit(items);
    const dirty = new Set<HTMLElement>();
    let frame = 0;
    const ro = new ResizeObserver(entries => {
      entries.forEach(e => dirty.add(e.target as HTMLElement));
      frame ||= requestAnimationFrame(() => { frame = 0; fit([...dirty].filter(c => c.isConnected)); dirty.clear(); });
    });
    items.forEach(c => ro.observe(c));
    return () => { ro.disconnect(); cancelAnimationFrame(frame); };
  }, deps);
}

export function NoteList({ onShown }: { onShown: (notes: Note[]) => void }) {
  const notes = useStore(visibleNotes);
  const s = useStore(useShallow(s => ({
    prefs: s.prefs, query: s.query, kind: s.searchKind, selecting: s.selecting, selection: s.selection, editorId: s.editor.id,
    unlocked: s.hiddenUnlocked, colors: s.folderColors, trash: inTrash(s), searching: s.searchOpen,
  })));
  const ref = useRef<HTMLElement>(null), more = useRef<HTMLButtonElement>(null);
  const key = [s.prefs.tab, s.prefs.by, s.prefs.sort, s.prefs.dir, s.query, s.kind].join('|');
  const [page, setPage] = useState({ key, limit: CONFIG.pageSize as number });
  const limit = page.key === key ? page.limit : CONFIG.pageSize, shown = useMemo(() => notes.slice(0, limit), [notes, limit]);
  const left = notes.length - shown.length, next = () => setPage({ key, limit: limit + CONFIG.pageSize });
  const recents = s.searching && !s.query.trim() && !s.kind, pinned = s.trash || s.searching ? 0 : notes.filter(n => n.pinned).length;
  const cards = s.prefs.view === 'cards' && !s.searching, showFolder = !s.prefs.tab.startsWith('f:');

  useMasonry(ref, cards, [shown, cards, s.selecting, s.query]);
  useEffect(() => onShown(shown), [shown, onShown]);
  useEffect(() => {
    const el = more.current;
    if (!el || !window.IntersectionObserver) return;
    const io = new IntersectionObserver(e => e.some(x => x.isIntersecting) && next(), { rootMargin: '800px 0px' });
    io.observe(el);
    return () => io.disconnect();
  });

  const card = (n: Note, inShelf: boolean) => (
    <Card key={n.id} note={n} inShelf={inShelf} grip={n.pinned && pinned > 1} selecting={s.selecting} selected={s.selecting && s.selection.has(n.id)}
      isOpen={s.editorId === n.id} readable={!n.locked || s.unlocked} query={s.query} color={n.folder ? folderColor(n.folder, s.colors) : null}
      date={s.prefs.sort === 'created' ? n.created : n.updated} showFolder={showFolder} />
  );
  const section = (title: string, count: number, list: Note[], inShelf: boolean) => list.length > 0 && (
    <Fragment key={title}>
      <h2 className="list-heading">{title}<span className="heading-count">{count}</span></h2>
      {list.map(n => card(n, inShelf))}
    </Fragment>
  );
  let body: React.ReactNode;
  if (!notes.length) body = <Empty />;
  else if (recents) {
    const groups = new Map<string, Note[]>();
    [...shown].sort((a, b) => b.updated - a.updated).forEach(n => groups.set(dayGroup(n.updated), [...(groups.get(dayGroup(n.updated)) || []), n]));
    body = [<h2 key="r" className="list-heading is-section">Récents</h2>, ...[...groups].map(([t, l]) => section(t, l.length, l, false))];
  } else if (pinned > 0 && pinned < notes.length)
    body = [section('Épinglées', pinned, shown.filter(n => n.pinned), true), section('Autres notes', notes.length - pinned, shown.filter(n => !n.pinned), false)];
  else body = shown.map(n => card(n, false));

  return (
    <main className={'note-list' + (cards ? ' cards' : '')} id="note-list" ref={ref}>
      {body}
      {left > 0 && <button className="text-btn list-more" ref={more} onClick={next}>Afficher {plural(Math.min(left, CONFIG.pageSize), 'note', 'notes')} de plus</button>}
    </main>
  );
}
