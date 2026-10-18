import type { Note, Prefs } from './types';

/** Tunables — one place for every magic number. */
export const CONFIG = {
  pageSize: 60,
  saveDelay: 300,
  toastMs: 5000,
  trashDays: 30,
  versionsMax: 10,
  attWarnBytes: 25e6,
  longPressMs: 450,
  swipeStart: 12,
  swipeMax: 96,
  pullToSearch: 72,
  editorDragClose: 96,
  backupNagDays: 14,
  ocrMaxSide: 2000,
  reminderPollMs: 30000,
  studyBoxes: [0, 1, 3, 7, 14, 30],
  audioRates: [1, 1.25, 1.5, 2],
  wavePeaks: 28,
  splitMedia: '(min-width:64em)',
} as const;

export const DAY = 864e5;

export const DEFAULT_FOLDERS = ['Idées', 'Travail', 'Personnel'];
export const FOLDER_COLORS = ['bleu', 'orange', 'vert', 'violet', 'rose', 'turquoise', 'brun', 'gris'];

export const DEFAULT_PREFS: Prefs = {
  tab: 'all', view: 'cards', sort: 'updated', dir: 'desc', by: 'all',
  theme: 'auto', hand: 'right', tint: 'off', font: 'sans',
};

/* Smart views shown in the Library and the search filter chips */
export const KINDS = ['week', 'study', 'lists', 'dated', 'links', 'photos', 'audio', 'pdfs'] as const;
export const SEARCH_KINDS = ['photos', 'audio', 'pdfs', 'lists', 'links', 'dated'] as const;
export type Kind = (typeof KINDS)[number];

export const KIND_ICON: Record<string, string> = {
  photos: 'image', audio: 'audio', pdfs: 'doc', lists: 'checklist', links: 'link', dated: 'calendar', week: 'history', study: 'study',
  all: 'all', none: 'folder', locked: 'lock', trash: 'trash',
};

export const TAB_LABEL: Record<string, string> = {
  all: 'Tout', week: 'Cette semaine', lists: 'Listes', dated: 'Avec une date', links: 'Liens', photos: 'Photos',
  audio: 'Notes vocales', pdfs: 'PDF', study: 'À réviser', none: 'Non catégorisé', trash: 'Récemment supprimé', locked: 'Notes masquées',
};

export const TEMPLATES = [
  { id: 'list', label: 'Liste à cocher', icon: 'checklist', title: () => '', body: '- [ ] ¦' },
  {
    id: 'meeting', label: 'Réunion', icon: 'all', title: (d: Date) => 'Réunion du ' + d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }),
    body: '## Participants\n- ¦\n\n## Ordre du jour\n1. \n\n## Décisions\n- \n\n## Actions\n- [ ] ',
  },
  { id: 'project', label: 'Projet', icon: 'outline', title: () => '', body: '## Objectif\n¦\n\n## Étapes\n- [ ] \n\n## Notes\n' },
  { id: 'study', label: 'Fiche de révision', icon: 'study', title: () => '', body: '## Points clés\n- ¦\n\n## Cartes\nQuestion :: Réponse' },
] as const;

export const HINTS: { id: string; text: string; fine?: boolean }[] = [
  { id: 'hold', text: 'Appui long sur + : liste, photo, modèle ou import' },
  { id: 'pull', text: 'Tirez la liste vers le bas pour chercher' },
  { id: 'select', text: 'Appui long sur une note pour en sélectionner plusieurs' },
  { id: 'swipe', text: 'Glissez une note pour l’épingler ou la supprimer' },
  { id: 'paste', text: 'Collez une image ou un lien pour en faire une note', fine: true },
  { id: 'links', text: 'Écrivez [[Titre]] pour relier deux notes' },
  { id: 'cards', text: 'Écrivez « Question :: Réponse » pour créer une carte à réviser' },
  { id: 'hidden', text: '⋮ → Masquer range une note dans Notes masquées' },
];

export const TOUR = [
  { target: '#fab', title: 'Créer', text: 'Touchez + : une note s’ouvre, prête à écrire. Appui long : liste, photo, note du jour, modèles ou import.', hints: ['hold', 'paste'] },
  { target: '#mic', title: 'Dicter', text: 'Le micro enregistre un message vocal ; touchez-le encore pour l’arrêter.', hints: [] },
  { target: '#search-button', title: 'Chercher', text: 'La recherche s’ouvre en bas, au-dessus du clavier. Vous pouvez aussi tirer la liste vers le bas.', hints: ['pull'] },
  { target: '#nav-island', title: 'Ranger', text: 'Bibliothèque : dossiers, étiquettes, collections, Notes masquées, corbeille. Réglages : thème, main dominante, sauvegarde.', hints: ['hidden'] },
  { target: '#note-list .card', title: 'Vos notes', text: 'Touchez pour ouvrir, ⋮ pour les actions. Glissez à droite pour épingler, à gauche pour supprimer ; appui long pour sélectionner.', hints: ['select', 'swipe'] },
  { target: null, title: 'Dans une note', text: 'Tout est en bas : Aa met en forme, la case ajoute une liste, le trombone joint un fichier, ⋮ pour le reste et ✓ termine. Glissez la note vers le bas pour la fermer.', hints: ['links', 'cards'] },
];

export const CREDITS: [string, string][] = [
  ['Figtree', 'police · SIL Open Font License'],
  ['pdf.js', 'lecture des PDF · Apache 2.0'],
  ['Tesseract.js', 'texte des photos · Apache 2.0'],
  ['PptxGenJS', 'export PowerPoint · MIT'],
  ['React, Zustand', 'interface · MIT'],
];

/* ---------- Changelog (newest first; calendar versions YY.M.D.n) ---------- */
export const CHANGE_KINDS = [
  { kind: 'new', title: 'Nouveau', one: 'nouveauté', many: 'nouveautés', icon: 'sparkle' },
  { kind: 'fix', title: 'Corrections', one: 'correction', many: 'corrections', icon: 'bug' },
  { kind: 'better', title: 'Améliorations', one: 'amélioration', many: 'améliorations', icon: 'improve' },
] as const;
type ChangeKind = (typeof CHANGE_KINDS)[number]['kind'];
export interface Release { date: string; legacy?: string; changes: Partial<Record<ChangeKind, string[]>>; version: string }

const RELEASES: Omit<Release, 'version'>[] = [
  {
    date: '2026-10-18',
    changes: {
      new: [
        'Verre liquide : îlots flottants translucides sur un fond calme',
        'Deux îlots au pouce : Bibliothèque et Réglages d’un côté ; Recherche, micro et + de l’autre, inversés pour les gauchers',
        'Le + crée une note en une touche ; appui long pour liste, photo, modèles et import',
        'La recherche s’ouvre en bas, au-dessus du clavier ; tirer la liste vers le bas la lance aussi',
      ],
      better: [
        'Éditeur : toutes les actions en bas (Aa, liste, trombone, ⋮, ✓), glisser vers le bas pour fermer',
        'Menus en feuilles venues du bas, du côté du pouce',
      ],
      fix: [
        'Le mode gaucher inverse à nouveau toutes les barres et tous les menus',
        'Plus aucune action fréquente dans le coin haut de l’écran',
      ],
    },
  },
  {
    date: '2026-10-15',
    changes: {
      new: [
        'Navigation en bas : Notes, Recherche, Bibliothèque et Réglages, avec le + à côté',
        'Le + crée une note texte, une liste, une photo ou un message vocal en un geste',
        'La recherche devient une page : notes récentes par jour, filtres, résultats dès la première lettre',
        '⋮ sur chaque note : épingler, déplacer, partager, masquer, supprimer',
      ],
      better: [
        'Éditeur presque sans boutons',
        'Cartes plus calmes : titre, date et dossier, le texte, puis des compteurs discrets',
        'Gestes réduits à trois : glisser à droite pour épingler, à gauche pour supprimer, appui long pour sélectionner',
      ],
    },
  },
  {
    date: '2026-10-09',
    changes: {
      new: [
        'Étiquettes : un mot précédé de # range la note sous cette étiquette',
        'Collections : une recherche enregistrée, à côté des dossiers',
        'Modèles (liste, réunion, projet, fiche de révision) et note du jour',
        'Importer Markdown, texte, web, un dossier (Obsidian) ou un livre EPUB',
        'Texte dans les photos : lu sur l’appareil, trouvé par la recherche',
        'Exporter un dossier en présentation PowerPoint',
      ],
    },
  },
  { date: '2026-10-09', changes: { new: ['Numéros de version datés : année.mois.jour.n, dans la ligne 26H2'] } },
  { date: '2026-10-09', legacy: '2.2.0', changes: { new: ['Quoi de neuf après une mise à jour', 'Journal des modifications en frise'] } },
  {
    date: '2026-10-09', legacy: '2.1.0',
    changes: { new: ['Bouton Aa : titres, gras, italique, surligné, listes, liens entre notes', 'Accueil, visite guidée et panneau À propos'] },
  },
  {
    date: '2026-10-09', legacy: '2.0.0',
    changes: {
      new: ['Installable et utilisable hors ligne', 'Partager → Notes depuis les autres apps', 'Rappel de sauvegarde après deux semaines'],
      fix: ['Enregistrement vocal sur iPhone'],
      better: ['Application reconstruite (React, TypeScript)', 'Code PIN renforcé'],
    },
  },
  { date: '2026-10', legacy: '1.3', changes: { new: ['Cartes de révision, carte des liens [[ ]], vue d’ensemble d’un dossier'] } },
  { date: '2026-10', legacy: '1.2', changes: { new: ['Dates, adresses, numéros et liens deviennent des boutons', 'Rappels, historique, messages vocaux'] } },
  { date: '2026-10', legacy: '1.1', changes: { better: ['Design system Notes : îlots au pouce, thème sombre, couleurs de dossiers'] } },
  { date: '2026-09', legacy: '1.0', changes: { new: ['Première version : notes, listes, dossiers, recherche, photos, corbeille'] } },
];

export const RELEASE_LIST: Release[] = RELEASES.map((r, i) => {
  const [y, m, d] = r.date.split('-').map(Number);
  const n = RELEASES.slice(i).filter(o => o.date === r.date).length;
  return { ...r, version: d ? `${y % 100}.${m}.${d}.${n}` : r.legacy! };
});
export const CURRENT = RELEASE_LIST[0];
export const halfYear = (r: Release) => {
  const [y, m] = r.date.split('-').map(Number);
  return `${y % 100}H${m > 6 ? 2 : 1}`;
};
export const findRelease = (v: string) => RELEASE_LIST.find(r => r.version === v || r.legacy === v);
export const releasesSince = (v: string) => {
  const r = findRelease(v);
  return r ? RELEASE_LIST.slice(0, RELEASE_LIST.indexOf(r)) : [];
};

/* ---------- Starter notes ---------- */
export const GUIDE_TITLE = 'Comment utiliser';
const WELCOME = `Notes garde vos idées, listes, photos et messages vocaux **sur cet appareil** : pas de compte, rien n’est envoyé, et tout fonctionne ==hors ligne==.

## Premiers pas
- [ ] Lire [[${GUIDE_TITLE}]]
- [ ] Écrire une note avec le bouton +
- [ ] Ranger une note dans un dossier
- [ ] Exporter une première sauvegarde

## Bon à savoir
- La visite guidée et le journal des modifications sont dans **Réglages → À propos**.
- Ajoutez Notes à l’écran d’accueil : elle s’ouvre comme une app et le navigateur ne peut plus effacer vos notes.

Bonne écriture !`;

const GUIDE = `# Écrire
Touchez le texte pour le modifier ; il reprend sa mise en forme quand vous avez fini. En bas de la note, **Aa** ouvre la mise en forme :
- **H** : titre, puis sous-titre, puis intertitre
- **Gras**, *italique* et ==surligné==
- Listes à puces, numérotées ou à cocher
- [[Bienvenue]] : un lien vers une autre note

Au clavier : Ctrl (⌘ sur Mac) + B, I, Maj+H, Maj+7, 8 ou 9. Entrée continue une liste ; Entrée sur un élément vide la termine.

# Créer
1. **+** : une nouvelle note, prête à écrire
2. Appui long sur **+** : liste, photo, note du jour, modèles, import d’un PDF, d’un fichier texte ou d’un livre EPUB
3. Le **micro** à côté enregistre un message vocal
4. Collez une image ou un lien n’importe où : il devient une note

# Organiser
- ⋮ sur une note : épingler, déplacer, partager, masquer, supprimer
- Glissez une note vers la droite pour l’**épingler**, vers la gauche pour la **supprimer**
- Appui long : sélectionner plusieurs notes, puis les déplacer, les fusionner ou les partager
- **Bibliothèque** : dossiers, étiquettes, collections, corbeille ; chaque dossier a sa couleur et sa vue d’ensemble
- Un mot précédé de #, comme #idées, est une **étiquette**

# Retrouver
La **loupe**, en bas, ouvre la recherche au-dessus du clavier ; vous pouvez aussi tirer la liste vers le bas. La recherche lit le texte des PDF et des photos. **Enregistrer** garde une recherche comme collection.

# Réviser
Écrivez une question et sa réponse sur une ligne, séparées par deux deux-points (::), comme ceci :
Capitale du Canada :: Ottawa
**⋮ → Réviser** vous interroge au bon moment.

# Agir
Les dates, adresses, numéros et liens d’une note deviennent des boutons, à la fin du texte. **⋮ → Rappel** programme un rappel.

# Sauvegarder
Tout reste sur cet appareil : exportez une sauvegarde de temps en temps (**Réglages → Exporter les notes**). Chaque note garde ses 10 dernières versions.`;

export const STARTER_NOTES: Pick<Note, 'title' | 'body'>[] = [
  { title: GUIDE_TITLE, body: GUIDE },
  { title: 'Bienvenue', body: WELCOME },
];

export const MSG = {
  trashed: 'Note placée dans la corbeille',
  folderExists: 'Ce dossier existe déjà.',
  badBackup: 'Fichier illisible : choisissez une sauvegarde .json exportée depuis Notes.',
} as const;
