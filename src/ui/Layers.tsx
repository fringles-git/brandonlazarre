/** Bottom sheets that pop over the list or the editor, from the thumb side: create, note menu, library, pickers, PIN… */
import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { LayerMode, Note } from '../types';
import { FOLDER_COLORS, KIND_ICON, KIND_TONE, KINDS } from '../config';
import { checkStats, entities, noteTools, outline, stripCheck, tagsOf } from '../markdown';
import { countIn, folderColor, get, menuNote, openNote, readableNotes, tabFolder, tabLabel, useStore, type State } from '../store';
import {
  clearChecked, closeLayer, createAndOpen, dailyNote, deleteCollection, deleteFolder, menuDeleteForever, menuHide, menuPin,
  menuRestore, menuTrash, moveSelection, moveTo, openLayer, openPicker, patchLayer, renameCollection, renameFolder, resetPin, restoreVersion,
  setFolderColor, setPref, setTab, submitFolder, submitPin, toggleEditFolders, toggleNewFolder, uncheckList, editorRefs,
} from '../actions';
import { clearReminder, toggleRecording, mergeSelection, openMap, pasteClipboard, reminderToCalendar, setReminder, shareOne, shareSelection, startStudy } from '../features';
import { caretTop, day, dayOrTime, dayTime, finePointer, plural } from '../utils';
import { InlineForm, Layer, Option, Row, shown } from './kit';
import { Icon } from './icons';
import { pickFile } from './Files';

const Title = ({ children }: { children: React.ReactNode }) => <p className="layer-title">{children}</p>;
const Hint = ({ children }: { children: React.ReactNode }) => <p className="layer-hint">{children}</p>;

function TabRow({ tab, trailing, pressed, onClick }: { tab: string; trailing?: React.ReactNode; pressed?: boolean; onClick: () => void }) {
  const color = useStore(s => (tabFolder(tab) ? folderColor(tabFolder(tab), s.folderColors) : undefined));
  return <Row icon={KIND_ICON[tab] || { f: 'folder', t: 'hash', c: 'filter' }[tab[0]] || 'folder'} label={tabLabel(tab)} trailing={trailing} pressed={pressed} color={color} tone={KIND_TONE[tab]} onClick={onClick} />;
}
const NewFolder = () => <InlineForm onSubmit={submitFolder} button="Créer le dossier" inputProps={{ placeholder: 'Nom du dossier', 'aria-label': 'Nom du dossier' }} />;

/* ---------- Create (long press on +) ---------- */
/** + : three ways to capture. */
function Create() {
  const tile = (id: string, icon: string, tone: string, label: string, hint: string, onClick: () => void) => (
    <button className="tile" id={'create-' + id} data-tone={tone} onClick={onClick}>
      <span className="lib-bubble"><Icon name={icon} /></span><b>{label}</b><small>{hint}</small>
    </button>
  );
  return (
    <>
      <Title>Créer</Title>
      <div className="tiles" role="group" aria-label="Nouvelle note">
        {tile('note', 'edit', 'yellow', 'Note', 'Texte, liste, carte…', () => { closeLayer(); createAndOpen(); })}
        {tile('mic', 'mic', 'red', 'Vocal', 'Enregistrer', () => { closeLayer(); toggleRecording(); })}
        {tile('import', 'download', 'blue', 'Importer', 'Photo, PDF, fichier', () => { useStore.setState({ importTarget: 'new' }); openLayer('import'); })}
      </div>
      <Row icon="calendar" label="Note du jour" trailing={day(Date.now())} onClick={dailyNote} />
    </>
  );
}

function Import() {
  const attach = useStore(s => s.importTarget === 'open'), pick = (kind: Parameters<typeof pickFile>[0]) => () => { closeLayer(); pickFile(kind); };
  return (
    <>
      <Title>{attach ? 'Joindre' : 'Importer'}</Title>
      <Hint>{attach ? 'Le fichier est ajouté à cette note.' : 'Le contenu devient une nouvelle note.'}</Hint>
      <Row icon="image" label="Une image" onClick={pick('image')} />
      <Row icon="camera" label="Une photo" onClick={pick('photo')} />
      <Row icon="audio" label="Un fichier audio" onClick={pick('audio')} />
      <Row icon="doc" label="Un PDF" onClick={pick('pdf')} />
      {!attach && <>
        <Row icon="paste" label="Le presse-papiers" onClick={pasteClipboard} />
        <hr />
        <Row icon="all" label="Des fichiers texte" trailing="Markdown, EPUB" onClick={pick('text')} />
        {'webkitdirectory' in document.createElement('input') && !/iPhone|iPad/.test(navigator.userAgent) &&
          <Row icon="folder" label="Un dossier de notes" trailing="Obsidian…" onClick={pick('folder')} />}
      </>}
    </>
  );
}

/* ---------- Note menu ---------- */
function NoteTools({ note }: { note: Note }) {
  const { heads, cards, due, done, linked } = noteTools(note, useStore(readableNotes));
  return (
    <>
      {heads > 1 && <Row icon="outline" label="Plan" trailing={plural(heads, 'titre', 'titres')} onClick={() => openLayer('outline')} />}
      {cards > 0 && <Row icon="study" label="Réviser" trailing={due ? due + ' à revoir' : plural(cards, 'carte', 'cartes')} onClick={() => { closeLayer(); startStudy([note]); }} />}
      {linked && <Row icon="graph" label="Carte des liens" onClick={() => { closeLayer(); openMap(note.id); }} />}
      {done > 0 && <Row icon="listReset" label="Éléments cochés" trailing={String(done)} onClick={() => openLayer('list-actions')} />}
      {note.versions.length > 0 && <Row icon="history" label="Historique" trailing={plural(note.versions.length, 'version', 'versions')} onClick={() => openLayer('history')} />}
    </>
  );
}
function NoteMenu() {
  const s = useStore(useShallow(s => ({ note: menuNote(s), open: s.editor.id })));
  const n = s.note;
  if (!n) return null;
  const inEditor = n.id === s.open, remind = !!n.remind && !n.remindDone;
  if (n.deleted) return (
    <>
      <Title>{n.title || 'Sans titre'}</Title>
      <Row icon="restore" label="Restaurer" onClick={menuRestore} />
      <Row className="row danger" icon="trash" label="Supprimer définitivement" onClick={menuDeleteForever} />
    </>
  );
  return (
    <>
      <Title>{n.title || 'Sans titre'}</Title>
      <Row icon="pin" label={n.pinned ? 'Désépingler' : 'Épingler'} onClick={menuPin} />
      <Row icon="folder" label="Déplacer" trailing={n.folder || 'Sans dossier'} onClick={openPicker} />
      {inEditor && <Row icon="bell" label="Rappel" trailing={remind ? dayTime(n.remind!) : undefined} onClick={() => openLayer('remind')} />}
      <Row icon="share" label="Partager" onClick={() => { closeLayer(); shareOne(n); }} />
      <Row icon="lock" label={n.locked ? 'Ne plus masquer' : 'Masquer'} onClick={menuHide} />
      {inEditor && <><hr /><NoteTools note={n} /></>}
      <hr />
      <Row className="row danger" icon="trash" label="Supprimer" onClick={menuTrash} />
    </>
  );
}

function ListActions() {
  const done = useStore(s => checkStats(openNote(s)?.body || '').done);
  return (
    <>
      <Title>Liste</Title>
      <Hint>{plural(done, 'élément coché', 'éléments cochés')}.</Hint>
      <Row icon="listReset" label="Tout décocher" trailing="liste réutilisable" onClick={uncheckList} />
      <Row icon="trash" label="Supprimer les éléments cochés" onClick={clearChecked} />
    </>
  );
}

const IosInstall = () => (
  <>
    <Title>Garder vos notes sur iPhone</Title>
    <Hint>Safari peut effacer les données d’un site non installé après 7 jours sans visite. Installée sur l’écran d’accueil, l’app garde vos notes.</Hint>
    <ol className="steps">
      <li>Touchez <b>Partager</b> en bas de Safari</li>
      <li>Choisissez <b>Sur l’écran d’accueil</b></li>
      <li>Ouvrez Notes depuis la nouvelle icône</li>
    </ol>
    <div className="layer-foot end"><button className="text-btn" onClick={() => { setPref('iosInstallDismissed', true); closeLayer(); }}>Ne plus afficher</button></div>
  </>
);

/* ---------- Library ---------- */
function FolderEditRow({ folder }: { folder: string }) {
  const s = useStore(useShallow(s => ({ renaming: s.layer.renaming === folder, coloring: s.layer.coloring === folder, color: folderColor(folder, s.folderColors) })));
  if (s.renaming) return <InlineForm onSubmit={renameFolder} button="Valider le nouveau nom" inputProps={{ defaultValue: folder, 'aria-label': 'Nouveau nom du dossier' }} />;
  return (
    <>
      <div className="row row-static" data-color={s.color}>
        <button className="icon-btn row-color" onClick={() => patchLayer({ coloring: s.coloring ? null : folder, renaming: null })} aria-expanded={s.coloring}
          aria-label={`Couleur de ${folder} : ${FOLDER_COLORS[s.color - 1]}`}><Icon name="folder" /></button>
        <span className="row-label">{folder}</span>
        <span className="row-actions">
          <button className="icon-btn" onClick={() => patchLayer({ renaming: folder })} aria-label={'Renommer ' + folder}><Icon name="edit" /></button>
          <button className="icon-btn danger-text" onClick={() => deleteFolder(folder)} aria-label={'Supprimer le dossier ' + folder}><Icon name="trash" /></button>
        </span>
      </div>
      {s.coloring && (
        <div className="swatches" role="group" aria-label={'Couleur de ' + folder}>
          {FOLDER_COLORS.map((c, i) => (
            <button key={c} className="swatch" data-color={i + 1} onClick={() => setFolderColor(folder, i + 1)} aria-pressed={s.color === i + 1} aria-label={c}><Icon name="check" /></button>
          ))}
        </div>
      )}
    </>
  );
}
function CollectionEditRow({ name }: { name: string }) {
  const renaming = useStore(s => s.layer.renaming === 'c:' + name);
  if (renaming) return <InlineForm onSubmit={v => renameCollection(name, v)} button="Valider le nouveau nom" inputProps={{ defaultValue: name, 'aria-label': 'Nouveau nom de la collection' }} />;
  return (
    <div className="row row-static">
      <Icon name="filter" />
      <span className="row-label">{name}</span>
      <span className="row-actions">
        <button className="icon-btn" onClick={() => patchLayer({ renaming: 'c:' + name })} aria-label={'Renommer ' + name}><Icon name="edit" /></button>
        <button className="icon-btn danger-text" onClick={() => deleteCollection(name)} aria-label={'Supprimer la collection ' + name}><Icon name="trash" /></button>
      </span>
    </div>
  );
}
/** The Library: a full page of views, folders, tags and collections — tiles instead of rows. */
function Library() {
  const s = useStore(useShallow(s => ({
    tab: s.prefs.tab, folders: s.folders, newFolder: s.layer.newFolder, edit: s.layer.editFolders, unlocked: s.hiddenUnlocked,
    notes: s.notes, collections: s.prefs.collections, colors: s.folderColors,
  })));
  const state = get(), live = s.notes.filter(n => !n.deleted && !n.locked), linked = live.some(n => entities(n).links.length);
  const views = ['all', ...KINDS.filter(k => s.tab === k || countIn(state, k) > 0)];
  const tags = new Map<string, number>();
  live.forEach(n => tagsOf(n).forEach(t => tags.set(t, (tags.get(t) || 0) + 1)));
  const top = Math.max(1, ...tags.values());
  const tile = (t: string, label = tabLabel(t), count: number | string = countIn(state, t), onClick = () => setTab(t)) => (
    <button key={t} className="lib-tile" data-tone={KIND_TONE[t]} aria-pressed={s.tab === t} onClick={onClick}>
      <span className="lib-bubble"><Icon name={KIND_ICON[t] || 'graph'} /></span>
      <b>{shown(count) ? count : ''}</b>
      <span>{label}</span>
    </button>
  );
  const recent = (f: string) => live.filter(n => n.folder === f).sort((a, b) => b.updated - a.updated);
  return (
    <div className="lib">
      <header className="lib-head">
        <div>
          <h2>Bibliothèque</h2>
          <p>{plural(live.length, 'note', 'notes')}{s.folders.length ? ' · ' + plural(s.folders.length, 'dossier', 'dossiers') : ''}</p>
        </div>
        <button className="icon-btn glass" onClick={toggleEditFolders} aria-label="Modifier les dossiers" aria-pressed={s.edit}><Icon name="edit" /></button>
        <button className="icon-btn glass" onClick={closeLayer} aria-label="Fermer"><Icon name="close" /></button>
      </header>

      <section className="lib-section">
        <h4>Vues</h4>
        <div className="lib-tiles">
          {views.map(t => tile(t))}
          {linked && tile('map', 'Carte des liens', '', () => { closeLayer(); openMap(); })}
        </div>
      </section>

      <section className="lib-section">
        <h4>Dossiers</h4>
        {s.edit ? <div className="lib-rows">{s.folders.map(f => <FolderEditRow key={f} folder={f} />)}</div> : (
          <div className="lib-folders">
            {countIn(state, 'none') > 0 && (
              <button className="lib-folder" aria-pressed={s.tab === 'none'} onClick={() => setTab('none')}>
                <span className="lib-folder-name">{tabLabel('none')}</span><b>{countIn(state, 'none')}</b>
              </button>
            )}
            {s.folders.map(f => {
              const notes = recent(f);
              return (
                <button key={f} className="lib-folder" data-color={folderColor(f, s.colors)} aria-pressed={s.tab === 'f:' + f} onClick={() => setTab('f:' + f)}>
                  <span className="lib-folder-name">{f}</span>
                  {notes.length > 0 && <b>{notes.length}</b>}
                  <span className="lib-peek">{notes.slice(0, 2).map(n => <i key={n.id}>{n.title || 'Sans titre'}</i>)}</span>
                </button>
              );
            })}
            {!s.newFolder && <button className="lib-folder is-new" onClick={toggleNewFolder}><Icon name="folderNew" /><span>Nouveau dossier</span></button>}
          </div>
        )}
        {s.newFolder && <NewFolder />}
      </section>

      {tags.size > 0 && !s.edit && (
        <section className="lib-section">
          <h4>Étiquettes</h4>
          <div className="lib-cloud">
            {[...tags].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'fr')).map(([t, n]) => (
              <button key={t} className="lib-tag" aria-pressed={s.tab === 't:' + t} onClick={() => setTab('t:' + t)}
                style={{ '--weight': n / top } as React.CSSProperties}>#{t}{n > 1 && <small>{n}</small>}</button>
            ))}
          </div>
        </section>
      )}

      {!!s.collections?.length && (
        <section className="lib-section">
          <h4>Collections</h4>
          {s.edit ? <div className="lib-rows">{s.collections.map(c => <CollectionEditRow key={c.name} name={c.name} />)}</div>
            : <div className="chips">{s.collections.map(c => <button key={c.name} className="chip" aria-pressed={s.tab === 'c:' + c.name} onClick={() => setTab('c:' + c.name)}><Icon name="filter" />{c.name}</button>)}</div>}
        </section>
      )}

      <section className="lib-section lib-tiles is-small">
        {tile('locked', tabLabel('locked'), s.unlocked ? countIn(state, 'locked') : '')}
        {countIn(state, 'trash') > 0 && tile('trash')}
      </section>
    </div>
  );
}
function Picker() {
  const s = useStore(useShallow(s => ({ folders: s.folders, newFolder: s.layer.newFolder, selecting: s.selecting, current: (menuNote(s) || openNote(s))?.folder })));
  const here = (t: string) => !s.selecting && s.current !== undefined && (t === 'none' ? !s.current : s.current === tabFolder(t));
  const row = (t: string) => <TabRow key={t} tab={t} trailing={here(t) ? '✓' : ''} pressed={here(t)} onClick={() => moveTo(tabFolder(t))} />;
  return (
    <>
      <Title>Déplacer vers</Title>
      {row('none')}
      <hr />
      {s.folders.map(f => row('f:' + f))}
      <hr />
      {s.newFolder ? <NewFolder /> : <div className="layer-foot end"><button className="icon-btn" onClick={toggleNewFolder} aria-label="Nouveau dossier"><Icon name="folderNew" /></button></div>}
    </>
  );
}

/* ---------- PIN, reminder, history, selection, outline, view ---------- */
const PIN_TEXT = {
  new: { title: (has: boolean) => (has ? 'Nouveau code PIN' : 'Créer un code PIN'), hint: '4 à 8 chiffres. Il protège le dossier Notes masquées (contenu caché, non chiffré).' },
  auth: { title: () => 'Notes masquées', hint: 'Saisissez votre code PIN.' },
  change: { title: () => 'Changer le code PIN', hint: 'Saisissez d’abord le code actuel.' },
};
function Pin() {
  const s = useStore(useShallow(s => ({ step: s.layer.pinStep || 'auth', armed: s.layer.resetArmed, has: !!s.pinHash, hidden: s.notes.filter(n => n.locked).length })));
  const t = PIN_TEXT[s.step];
  return (
    <>
      <p className="layer-title" id="pin-title">{t.title(s.has)}</p>
      <Hint>{t.hint}</Hint>
      <InlineForm key={s.step} button="Valider" onSubmit={async (v, input) => { if (!(await submitPin(v))) { input.value = ''; input.focus(); } }}
        inputProps={{ className: 'pin-input', type: 'password', inputMode: 'numeric', maxLength: 8, autoComplete: 'off', 'aria-labelledby': 'pin-title' }} />
      {s.step !== 'new' && <>
        <div className="layer-foot">
          <button className="text-btn" onClick={() => patchLayer({ pinStep: s.step === 'auth' ? 'change' : 'auth', resetArmed: false })}>{s.step === 'auth' ? 'Changer le code' : 'Retour'}</button>
          <button className={'text-btn' + (s.armed ? ' armed' : '')} onClick={resetPin}>
            {s.armed ? (s.hidden ? 'Effacer ' + plural(s.hidden, 'note', 'notes') + ' ?' : 'Confirmer ?') : 'Code oublié ?'}
          </button>
        </div>
        {s.armed && <Hint>{s.hidden ? 'Réinitialiser efface définitivement les notes masquées.' : 'Aucune note masquée ne sera perdue.'}</Hint>}
      </>}
    </>
  );
}
function Remind() {
  const n = useStore(openNote);
  if (!n) return null;
  const now = new Date(), at = (days: number, h: number) => { const d = new Date(now); d.setDate(d.getDate() + days); d.setHours(h, 0, 0, 0); return d; };
  const inNote: [string, Date][] = entities(n).dates.filter(d => +d.start > Date.now()).slice(0, 2)
    .map(d => [d.hasTime ? 'Dans la note' : 'Dans la note, 9:00', d.hasTime ? d.start : new Date(new Date(d.start).setHours(9))]);
  const presets: [string, Date][] = [['Demain matin', at(1, 9)], ['Lundi matin', at((8 - now.getDay()) % 7 || 7, 9)]];
  if (now.getHours() < 17) presets.unshift(['Ce soir', at(0, 18)]);
  return (
    <>
      <Title>Rappel</Title>
      <Hint>Notes vous prévient tant qu’elle est ouverte. Ajoutez le rappel à l’agenda pour être prévenu partout.</Hint>
      {[...inNote, ...presets].map(([label, d]) => <Row key={label + +d} icon="bell" label={label} trailing={dayTime(+d)} onClick={() => setReminder(+d)} />)}
      <InlineForm autoFocus={false} button="Valider le rappel" onSubmit={v => setReminder(v ? new Date(v).getTime() : 0)}
        inputProps={{ type: 'datetime-local', 'aria-label': 'Date et heure du rappel' }} />
      {!!n.remind && !n.remindDone && (
        <div className="layer-foot"><button className="text-btn" onClick={clearReminder}>Retirer</button><button className="text-btn" onClick={reminderToCalendar}>Ajouter à l’agenda</button></div>
      )}
    </>
  );
}
function History() {
  const versions = useStore(s => openNote(s)?.versions || []);
  return (
    <>
      <Title>Historique</Title>
      <Hint>Une version est gardée chaque fois que la note change (10 au plus).</Hint>
      {versions.map((v, i) => (
        <Row key={i} icon="history" label={v.body.split('\n').map(l => stripCheck(l).trim()).find(Boolean) || v.title || 'Vide'} trailing={dayOrTime(v.t)} onClick={() => restoreVersion(i)} />
      ))}
    </>
  );
}
function SelMore() {
  const few = useStore(s => s.selection.size < 2);
  return (
    <>
      <Row icon="move" label="Déplacer vers un dossier" onClick={moveSelection} />
      <Row icon="merge" label="Fusionner en une note" onClick={mergeSelection} disabled={few} trailing={few ? '2 notes minimum' : undefined} />
      <Row icon="share" label="Partager" onClick={shareSelection} />
    </>
  );
}
function goToLine(line: number) {
  closeLayer();
  if (get().editor.reading) return document.querySelector(`#note-view [data-line="${line}"]`)?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  const el = editorRefs.body;
  if (!el) return;
  const at = el.value.split('\n').slice(0, line).join('\n').length + +!!line;
  el.setSelectionRange(at, at);
  el.scrollTop = caretTop(el, at) - parseFloat(getComputedStyle(el).paddingTop);
  if (finePointer()) el.focus({ preventScroll: true });
}
function Outline() {
  const body = useStore(s => openNote(s)?.body || ''), heads = useMemo(() => outline(body), [body]);
  return <><Title>Plan</Title>{heads.map(h => <Row key={h.line} className={'row row-h' + h.level} icon="outline" label={h.text} onClick={() => goToLine(h.line)} />)}</>;
}
function Sort() {
  return (
    <>
      <Title>Trier</Title>
      <h4>Par</h4>
      <Option pref="sort" value="updated" label="Dernière modification" />
      <Option pref="sort" value="created" label="Date de création" />
      <hr />
      <h4>Ordre</h4>
      <Option pref="dir" value="desc" label="Récentes d’abord" />
      <Option pref="dir" value="asc" label="Anciennes d’abord" />
    </>
  );
}

const LAYERS: Record<LayerMode, { label: string; Content: () => React.ReactNode }> = {
  create: { label: 'Créer', Content: Create },
  'note-menu': { label: 'Actions de la note', Content: NoteMenu },
  import: { label: 'Importer', Content: Import },
  'list-actions': { label: 'Actions de la liste', Content: ListActions },
  'ios-install': { label: 'Installer sur iPhone', Content: IosInstall },
  library: { label: 'Bibliothèque', Content: Library },
  picker: { label: 'Choisir un dossier', Content: Picker },
  pin: { label: 'Code PIN', Content: Pin },
  remind: { label: 'Rappel', Content: Remind },
  history: { label: 'Historique des versions', Content: History },
  'sel-more': { label: 'Plus d’actions', Content: SelMore },
  outline: { label: 'Plan de la note', Content: Outline },
  sort: { label: 'Trier', Content: Sort },
};

export function LayerHost() {
  const mode = useStore((s: State) => s.layer.mode), def = mode ? LAYERS[mode] : null;
  return (
    <Layer open={!!mode} onClose={closeLayer} label={def?.label || ''} className={'layer glass' + (mode === 'library' ? ' lib-page' : '')}
      anchor={mode !== 'library'} data={{ 'data-mode': mode || undefined }}>
      {def && <def.Content />}
    </Layer>
  );
}

