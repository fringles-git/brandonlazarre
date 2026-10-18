/** The bottom of the screen, within thumb reach: two islands + the + button, the in-dock search, selection and recording bars. */
import { useEffect, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { SEARCH_KINDS, KIND_ICON } from '../config';
import { filterNotes, inTrash, KIND_TEST, tabLabel, useStore, visibleNotes } from '../store';
import {
  allSelected, clearRecents, closeSearch, createAndOpen, deleteSelection, endSelecting, hideSelection, openSearch, pinSelection,
  restoreSelection, saveCollection, selectAll, setQuery, toggleKind, toggleLayer, toggleLibrary, toggleSettings,
} from '../actions';
import { cancelRecording, stopRecording, toggleRecording } from '../features';
import { clock, haptic, plural } from '../utils';
import { CONFIG } from '../config';
import { Icon } from './icons';

/** + : a tap writes a new note; a long press (or right-click) opens the Create sheet. */
function Fab() {
  const open = useStore(s => s.layer.mode === 'create'), timer = useRef(0), held = useRef(false);
  const hold = () => { held.current = true; haptic('open'); toggleLayer('create'); };
  return (
    <button className="fab" id="fab" aria-label="Nouvelle note (appui long : plus d’options)" aria-haspopup="dialog" aria-expanded={open}
      onPointerDown={e => { if (e.button === 0) { held.current = false; timer.current = window.setTimeout(hold, CONFIG.longPressMs); } }}
      onPointerUp={() => clearTimeout(timer.current)} onPointerLeave={() => clearTimeout(timer.current)}
      onContextMenu={e => { e.preventDefault(); clearTimeout(timer.current); if (!held.current) hold(); }}
      onClick={() => { if (held.current) { held.current = false; return; } createAndOpen(); }}>
      <Icon name="plus" />
    </button>
  );
}

function MainDock() {
  const s = useStore(useShallow(s => ({ library: s.layer.mode === 'library', settings: s.sheet === 'settings', recording: s.recorder.on })));
  return (
    <nav className="dock thumb-row" aria-label="Navigation">
      <div className="island glass" id="nav-island">
        <button className="tab-btn" onClick={toggleLibrary} aria-pressed={s.library} aria-haspopup="dialog"><Icon name="library" /><span>Bibliothèque</span></button>
        <button className="tab-btn" onClick={toggleSettings} aria-pressed={s.settings} aria-haspopup="dialog"><Icon name="settings" /><span>Réglages</span></button>
      </div>
      <div className="thumb-group">
        <div className="island glass">
          <button className="icon-btn" id="search-button" onClick={openSearch} aria-label="Rechercher"><Icon name="search" /></button>
          <button className={'icon-btn' + (s.recording ? ' is-recording' : '')} id="mic" onClick={toggleRecording}
            aria-label={s.recording ? 'Arrêter l’enregistrement' : 'Enregistrer un message vocal'} aria-pressed={s.recording}>
            <Icon name={s.recording ? 'stop' : 'mic'} />
          </button>
        </div>
        <Fab />
      </div>
    </nav>
  );
}

function SearchDock() {
  const s = useStore(useShallow(s => ({
    notes: s.notes, tab: s.prefs.tab, by: s.prefs.by, query: s.query, kind: s.searchKind, unlocked: s.hiddenUnlocked,
    recents: s.prefs.recentSearches, collections: s.prefs.collections,
  })));
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { input.current?.focus({ preventScroll: true }); }, []);
  const kinds = SEARCH_KINDS.filter(k => {
    if (s.kind === k) return true;
    const pool = filterNotes(s.notes, { tab: s.tab, by: s.by, query: s.query, unlocked: s.unlocked, collections: s.collections });
    return pool.some(KIND_TEST[k]);
  });
  const where = s.tab === 'all' ? 'Notes' : tabLabel(s.tab), recents = s.query.trim() ? [] : s.recents || [];
  return (
    <div className="dock search-dock" role="search">
      <div className="search-chips" role="group" aria-label="Filtrer les résultats">
        <button className="chip glass" aria-pressed={!s.kind} onClick={() => s.kind && toggleKind(s.kind)}>Tout</button>
        {kinds.map(k => <button key={k} className="chip glass" aria-pressed={s.kind === k} onClick={() => toggleKind(k)}><Icon name={KIND_ICON[k]} />{tabLabel(k)}</button>)}
        {(s.query.trim() || s.kind) && <button className="chip glass is-quiet" onClick={saveCollection} aria-label="Enregistrer cette recherche comme collection"><Icon name="filter" />Enregistrer</button>}
        {recents.map(r => <button key={r} className="chip glass is-quiet" onClick={() => { setQuery(r); input.current?.focus(); }} aria-label={'Rechercher ' + r}><Icon name="history" />{r}</button>)}
        {recents.length > 0 && <button className="text-btn" onClick={clearRecents}>Effacer</button>}
      </div>
      <div className="thumb-row">
        <label className="search-field island glass">
          <Icon name="search" />
          <input id="search-input" ref={input} type="search" enterKeyHint="search" placeholder={'Rechercher dans ' + where} aria-label={'Rechercher dans ' + where}
            value={s.query} onChange={e => setQuery(e.target.value)} />
          {s.query && <button className="search-clear" onClick={() => { setQuery(''); input.current?.focus(); }} aria-label="Effacer la recherche"><Icon name="close" /></button>}
        </label>
        <button className="fab is-quiet" onClick={closeSearch} aria-label="Fermer la recherche"><Icon name="close" /></button>
      </div>
    </div>
  );
}

function SelectionDock() {
  const s = useStore(useShallow(s => {
    const picked = s.notes.filter(n => s.selection.has(n.id));
    return {
      count: s.selection.size, trash: inTrash(s), armed: s.deleteArmed, all: allSelected(s), total: visibleNotes(s).length,
      pinned: picked.length > 0 && picked.every(n => n.pinned), hidden: picked.length > 0 && picked.every(n => n.locked), more: s.layer.mode === 'sel-more',
    };
  }));
  const none = !s.count;
  const btn = (icon: string, label: string, aria: string, onClick: () => void, extra: React.ButtonHTMLAttributes<HTMLButtonElement> = {}, cls = 'action-btn') => (
    <button className={cls} onClick={onClick} aria-label={aria} {...extra}><Icon name={icon} /><span>{label}</span></button>
  );
  return (
    <nav className="dock thumb-row is-compact" aria-label="Sélection">
      <div className="island glass sel-bar" role="toolbar" aria-label="Actions de sélection">
        {btn('selectAll', s.all ? 'Aucun' : 'Tout', s.all ? 'Tout désélectionner' : 'Tout sélectionner', selectAll, { 'aria-pressed': s.all, disabled: !s.total })}
        {btn('trash', s.armed ? 'Confirmer ?' : 'Supprimer', s.armed ? 'Confirmer la suppression de ' + plural(s.count, 'note', 'notes') : s.trash ? 'Supprimer définitivement la sélection' : 'Supprimer la sélection',
          deleteSelection, { disabled: none }, 'action-btn danger' + (s.armed ? ' armed' : ''))}
        {s.trash
          ? btn('restore', 'Restaurer', 'Restaurer la sélection', restoreSelection, { disabled: none })
          : <>
            {btn('lock', s.hidden ? 'Afficher' : 'Masquer', s.hidden ? 'Afficher la sélection' : 'Masquer la sélection', hideSelection, { disabled: none })}
            {btn('pin', s.pinned ? 'Désépingler' : 'Épingler', s.pinned ? 'Désépingler la sélection' : 'Épingler la sélection', pinSelection, { disabled: none })}
            {btn('more', 'Plus', 'Plus d’actions : déplacer, fusionner, partager', () => toggleLayer('sel-more'), { disabled: none, 'aria-haspopup': 'dialog', 'aria-expanded': s.more })}
          </>}
      </div>
      <button className="fab is-quiet sel-count" onClick={endSelecting} aria-label={'Terminer la sélection (' + plural(s.count, 'note sélectionnée', 'notes sélectionnées') + ')'}>
        <span aria-live="polite">{s.count}</span><Icon name="close" />
      </button>
    </nav>
  );
}

function RecordingBar() {
  const started = useStore(s => s.recorder.startedAt), [, tick] = useState(0);
  useEffect(() => { const t = setInterval(() => tick(x => x + 1), 500); return () => clearInterval(t); }, []);
  return (
    <div className="rec-bar island glass" role="status">
      <span className="rec-dot" aria-hidden="true" />
      <span>Enregistrement <b>{clock(Math.floor((Date.now() - started) / 1000))}</b></span>
      <button className="icon-btn" onClick={cancelRecording} aria-label="Annuler l’enregistrement"><Icon name="close" /></button>
      <button className="icon-btn stop" onClick={stopRecording} aria-label="Arrêter et garder"><Icon name="check" /></button>
    </div>
  );
}

export function Dock() {
  const s = useStore(useShallow(s => ({ searching: s.searchOpen, selecting: s.selecting, recording: s.recorder.on })));
  return (
    <>
      {s.recording && <RecordingBar />}
      {s.selecting ? <SelectionDock /> : s.searching ? <SearchDock /> : <MainDock />}
    </>
  );
}
