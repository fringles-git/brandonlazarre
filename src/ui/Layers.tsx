/** Bottom sheets that pop over the list or the editor, from the thumb side: create, note menu, library, pickers, PIN… */
import { useShallow } from 'zustand/react/shallow';
import type { LayerMode, Note } from '../types';
import { FOLDER_COLORS, KIND_ICON, KINDS, TEMPLATES } from '../config';
import { checkStats, dueCards, entities, flashcards, outline, backlinks, stripCheck, tagsOf } from '../markdown';
import { countIn, folderColor, get, menuNote, openNote, readableNotes, tabFolder, tabLabel, useStore, type State } from '../store';
import {
  clearChecked, closeLayer, dailyNote, deleteCollection, deleteFolder, endSelecting, fromTemplate, menuDeleteForever, menuHide, menuPin,
  menuRestore, menuTrash, moveSelection, moveTo, openLayer, openPicker, patchLayer, renameCollection, renameFolder, resetPin, restoreVersion,
  setFolderColor, setPref, setTab, startSelecting, submitFolder, submitPin, toggleEditFolders, toggleNewFolder, uncheckList, editorRefs,
} from '../actions';
import { clearReminder, mergeSelection, openMap, pasteClipboard, reminderToCalendar, setReminder, shareOne, shareSelection, startStudy } from '../features';
import { caretTop, dayOrTime, dayTime, finePointer, plural } from '../utils';
import { InlineForm, Layer, Option, Row, Segmented } from './kit';
import { Icon } from './icons';
import { pickFile } from './Files';

const Title = ({ children }: { children: React.ReactNode }) => <p className="layer-title">{children}</p>;
const Hint = ({ children }: { children: React.ReactNode }) => <p className="layer-hint">{children}</p>;

function TabRow({ tab, trailing, pressed, onClick }: { tab: string; trailing?: React.ReactNode; pressed?: boolean; onClick: () => void }) {
  const color = useStore(s => (tabFolder(tab) ? folderColor(tabFolder(tab), s.folderColors) : undefined));
  return <Row icon={KIND_ICON[tab] || { f: 'folder', t: 'hash', c: 'filter' }[tab[0]] || 'folder'} label={tabLabel(tab)} trailing={trailing} pressed={pressed} color={color} onClick={onClick} />;
}
const NewFolder = () => <InlineForm onSubmit={submitFolder} button="Créer le dossier" inputProps={{ placeholder: 'Nom du dossier', 'aria-label': 'Nom du dossier' }} />;

/* ---------- Create (long press on +) ---------- */
function Create() {
  const tile = (id: string, icon: string, label: string, onClick: () => void) => (
    <button className="tile glass" id={'create-' + id} onClick={onClick}><Icon name={icon} /><span>{label}</span></button>
  );
  return (
    <>
      <Title>Créer</Title>
      <div className="tiles" role="group" aria-label="Nouvelle note">
        {tile('list', 'checklist', 'Liste', () => fromTemplate('list'))}
        {tile('photo', 'camera', 'Photo', () => { closeLayer(); useStore.setState({ importTarget: 'new' }); pickFile('photo'); })}
        {tile('today', 'calendar', 'Du jour', dailyNote)}
        {tile('paste', 'paste', 'Coller', pasteClipboard)}
      </div>
      <Row icon="templates" label="Modèles" trailing="Réunion, projet…" onClick={() => openLayer('templates')} />
      <Row icon="download" label="Importer" trailing="PDF, Markdown…" onClick={() => { useStore.setState({ importTarget: 'new' }); openLayer('import'); }} />
    </>
  );
}
const Templates = () => <><Title>Modèles</Title>{TEMPLATES.map(t => <Row key={t.id} icon={t.icon} label={t.label} onClick={() => fromTemplate(t.id)} />)}</>;

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
  const readable = useStore(readableNotes), heads = outline(note.body).length, cards = flashcards(note.body).length, due = dueCards(note).length;
  const done = checkStats(note.body).done, linked = entities(note).links.length > 0 || backlinks(note, readable).length > 0;
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
function Library() {
  const s = useStore(useShallow(s => ({
    tab: s.prefs.tab, folders: s.folders, newFolder: s.layer.newFolder, edit: s.layer.editFolders, unlocked: s.hiddenUnlocked, notes: s.notes, collections: s.prefs.collections,
  })));
  const state = get(), shows = (t: string) => s.edit || s.tab === t || countIn(state, t) > 0;
  const folders = s.folders.filter(f => shows('f:' + f)), linked = s.notes.some(n => !n.deleted && !n.locked && entities(n).links.length);
  const tags = new Map<string, number>();
  s.notes.filter(n => !n.deleted && !n.locked).forEach(n => tagsOf(n).forEach(t => tags.set(t, (tags.get(t) || 0) + 1)));
  const tab = (t: string) => <TabRow key={t} tab={t} trailing={countIn(state, t)} pressed={s.tab === t} onClick={() => setTab(t)} />;
  return (
    <>
      <Title>Bibliothèque</Title>
      <h4>Vues</h4>
      {tab('all')}
      {KINDS.filter(k => s.tab === k || countIn(state, k) > 0).map(tab)}
      {linked && <Row icon="graph" label="Carte des liens" onClick={() => { closeLayer(); openMap(); }} />}
      <hr />
      {(shows('none') || folders.length > 0) && <>
        <h4>Dossiers</h4>
        {shows('none') && tab('none')}
        {folders.map(f => (s.edit ? <FolderEditRow key={f} folder={f} /> : tab('f:' + f)))}
        <hr />
      </>}
      {!!s.collections?.length && <>
        <h4>Collections</h4>
        {s.collections.map(c => (s.edit ? <CollectionEditRow key={c.name} name={c.name} /> : tab('c:' + c.name)))}
        <hr />
      </>}
      {tags.size > 0 && !s.edit && <>
        <h4>Étiquettes</h4>
        {[...tags].sort((a, b) => a[0].localeCompare(b[0], 'fr')).map(([t, n]) => <TabRow key={t} tab={'t:' + t} trailing={n} pressed={s.tab === 't:' + t} onClick={() => setTab('t:' + t)} />)}
        <hr />
      </>}
      {shows('trash') && tab('trash')}
      <TabRow tab="locked" trailing={s.unlocked ? countIn(state, 'locked') : ''} pressed={s.tab === 'locked'} onClick={() => setTab('locked')} />
      <hr />
      {s.newFolder ? <NewFolder /> : (
        <div className="layer-foot">
          <button className="icon-btn" onClick={toggleEditFolders} aria-label="Modifier les dossiers" aria-pressed={s.edit}><Icon name="edit" /></button>
          <button className="icon-btn" onClick={toggleNewFolder} aria-label="Nouveau dossier"><Icon name="folderNew" /></button>
        </div>
      )}
    </>
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
  const heads = useStore(s => outline(openNote(s)?.body || ''));
  return <><Title>Plan</Title>{heads.map(h => <Row key={h.line} className={'row row-h' + h.level} icon="outline" label={h.text} onClick={() => goToLine(h.line)} />)}</>;
}
function View() {
  const ai = useStore(s => s.notes.filter(n => n.by === 'ai' && !n.deleted).length);
  return (
    <>
      <Title>Affichage</Title>
      <Segmented pref="view" label="Vue" options={[['cards', <><Icon name="cards" />Cartes</>], ['list', <><Icon name="list" />Liste</>]]} />
      <h4>Trier par</h4>
      <Option pref="sort" value="updated" label="Dernière modification" />
      <Option pref="sort" value="created" label="Date de création" />
      <h4>Ordre</h4>
      <Option pref="dir" value="desc" label="Récentes d’abord" />
      <Option pref="dir" value="asc" label="Anciennes d’abord" />
      <h4>Afficher</h4>
      <Option pref="by" value="all" label="Toutes les notes" />
      <Option pref="by" value="me" label="Créées par moi" />
      <Option pref="by" value="ai" label="Créées avec l’IA" note={String(ai)} />
      <hr />
      <button className="option" onClick={() => { closeLayer(); if (get().selecting) endSelecting(); else startSelecting(); }}>
        <span>Sélectionner des notes</span><Icon name="selectAll" />
      </button>
    </>
  );
}

const LAYERS: Record<LayerMode, { label: string; Content: () => React.ReactNode }> = {
  create: { label: 'Créer', Content: Create },
  'note-menu': { label: 'Actions de la note', Content: NoteMenu },
  templates: { label: 'Modèles', Content: Templates },
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
  view: { label: 'Affichage', Content: View },
};

export function LayerHost() {
  const mode = useStore((s: State) => s.layer.mode), def = mode ? LAYERS[mode] : null;
  return (
    <Layer open={!!mode} onClose={closeLayer} label={def?.label || ''} className="layer glass" data={{ 'data-mode': mode || undefined }}>
      {def && <def.Content />}
    </Layer>
  );
}

