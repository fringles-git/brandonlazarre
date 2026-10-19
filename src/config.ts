import type { ChangeKind, Note, Prefs } from './types';

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
  wideMedia: '(min-width:40em) and (min-height:30em)',   // same as the tablet rules in app.css
} as const;

export const DAY = 864e5;

export const DEFAULT_FOLDERS = ['Idées', 'Travail', 'Personnel'];
export const FOLDER_COLORS = ['bleu', 'orange', 'vert', 'violet', 'rose', 'turquoise', 'brun', 'gris'];

export const DEFAULT_PREFS: Prefs = {
  tab: 'all', view: 'cards', sort: 'updated', dir: 'desc', by: 'all',
  theme: 'auto', hand: 'right', tint: 'off',
};

/* Smart views shown in the Library and the search filter chips */
export const KINDS = ['week', 'study', 'lists', 'dated', 'links', 'photos', 'audio', 'pdfs'] as const;
export const SEARCH_KINDS = ['photos', 'audio', 'pdfs', 'lists', 'links', 'dated'] as const;
export type Kind = (typeof KINDS)[number];

export const KIND_ICON: Record<string, string> = {
  photos: 'image', audio: 'audio', pdfs: 'doc', lists: 'checklist', links: 'link', dated: 'calendar', week: 'history', study: 'study',
  all: 'all', none: 'folder', locked: 'lock', trash: 'trash',
};

/** Semantic tones (system colors): same meaning everywhere — red records & deletes, orange dates, green photos… */
export const KIND_TONE: Record<string, string> = {
  all: 'yellow', week: 'purple', study: 'indigo', lists: 'blue', dated: 'orange', links: 'teal', photos: 'green',
  audio: 'pink', pdfs: 'red', none: 'gray', locked: 'gray', trash: 'red', map: 'teal',
};

export const TAB_LABEL: Record<string, string> = {
  all: 'Toutes les notes', week: 'Cette semaine', lists: 'Listes', dated: 'Avec une date', links: 'Liens', photos: 'Photos',
  audio: 'Notes vocales', pdfs: 'PDF', study: 'À réviser', none: 'Sans dossier', trash: 'Corbeille', locked: 'Notes masquées',
};

/** What an empty note can become (¦ = caret). Shown as chips while the note is empty. */
export const TEMPLATES = [
  { id: 'list', label: 'Liste', icon: 'checklist', tone: 'blue', title: () => '', body: '- [ ] ¦' },
  { id: 'card', label: 'Carte à réviser', icon: 'study', tone: 'indigo', title: () => '', body: '¦ :: ' },
  {
    id: 'meeting', label: 'Réunion', icon: 'all', tone: 'orange', title: (d: Date) => 'Réunion du ' + d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }),
    body: '## Participants\n- ¦\n\n## Ordre du jour\n1. \n\n## Décisions\n- \n\n## Actions\n- [ ] ',
  },
  { id: 'project', label: 'Projet', icon: 'outline', tone: 'teal', title: () => '', body: '## Objectif\n¦\n\n## Étapes\n- [ ] \n\n## Notes\n' },
  { id: 'study', label: 'Fiche de révision', icon: 'doc', tone: 'purple', title: () => '', body: '## Points clés\n- ¦\n\n## Cartes\nQuestion :: Réponse' },
  {
    id: 'today', label: 'Journal du jour', icon: 'calendar', tone: 'green', body: '#journal\n\n¦',
    title: (d: Date) => { const t = d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }); return t[0].toUpperCase() + t.slice(1); },
  },
] as const;

export const HINTS: { id: string; text: string; fine?: boolean }[] = [
  { id: 'pull', text: 'Tirez la liste vers le bas pour chercher' },
  { id: 'select', text: 'Appui long sur une note pour en sélectionner plusieurs' },
  { id: 'swipe', text: 'Glissez une note pour l’épingler ou la supprimer' },
  { id: 'paste', text: 'Collez une image ou un lien pour en faire une note', fine: true },
  { id: 'links', text: 'Écrivez [[Titre]] pour relier deux notes' },
  { id: 'cards', text: 'Écrivez « Question :: Réponse » pour créer une carte à réviser' },
  { id: 'hidden', text: '⋮ → Masquer range une note dans Notes masquées' },
];

export const TOUR = [
  { target: '#fab', title: 'Créer', text: '**+** ouvre trois choix : **Note**, **Vocal** ou **Importer** (photo, PDF, fichier). Une note vide propose ensuite : liste, carte à réviser, réunion…', hints: ['paste'] },
  { target: '#nav-island', title: 'Naviguer', text: '**Notes** revient à l’accueil, **Bibliothèque** range dossiers, étiquettes et collections, **Recherche** cherche partout, **Réglages** règle l’app.', hints: ['hidden', 'pull'] },
  { target: '#view-tools', title: 'Affichage', text: 'En haut : **cartes ou liste** et **trier**. Pour ne voir que les photos, listes ou dates : **Recherche** ou **Bibliothèque**.', hints: [] },
  { target: '#note-list .card', title: 'Vos notes', text: 'Touchez pour ouvrir, **⋮** pour les actions. Glissez à droite pour épingler, à gauche pour supprimer ; **appui long** pour en sélectionner plusieurs.', hints: ['select', 'swipe'] },
  { target: null, title: 'Dans une note', text: 'En bas : **Aa** met en forme, **☑** ajoute une case, **📎** joint un fichier, **⋮** pour le reste, **✓** termine. Glissez la note vers le bas pour la fermer.', hints: ['links', 'cards'] },
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
export interface Release { date: string; legacy?: string; changes: Partial<Record<ChangeKind, string[]>>; version: string }

const RELEASES: Omit<Release, 'version'>[] = [
  {
    date: '2026-10-19',
    changes: {
      fix: [
        'Dans la Bibliothèque, « Toutes les notes » ne paraît plus choisie quand rien n’est filtré',
        'À la première visite, l’app ne se recharge plus d’elle-même en se préparant pour le hors-ligne',
      ],
    },
  },
  {
    date: '2026-10-19',
    changes: {
      new: [
        'Sur tablette, Plan et Historique s’ouvrent à côté de la note sans la couvrir : on continue d’écrire, le plan reste ouvert',
        'Clic droit sur une note, à la souris : son menu',
        'Alt + ↑ / ↓ sur une note épinglée la monte ou la descend',
      ],
      better: [
        'La barre du bas glisse d’un onglet à l’autre, comme les choix des Réglages',
        'Numéros de version, étiquettes et points suivent la règle ÷3 : plus aucune forme ronde',
        'Une seule police, Figtree, pour l’interface et les notes',
        'Les notes Bienvenue et Comment utiliser jamais modifiées suivent le texte à jour',
        'Au lancement, le fond suit le thème clair ou sombre avant même l’affichage',
      ],
    },
  },
  {
    date: '2026-10-19',
    changes: {
      new: [
        'La Bibliothèque est une page comme la liste : son titre, la barre du bas reste ; un dossier ouvert revient à la Bibliothèque',
        'Réglages → Aide : visite guidée, guide d’utilisation et Quoi de neuf, à revoir quand vous voulez',
        'Police des notes au choix : Figtree ou Literata',
      ],
      better: [
        'La barre du bas ne disparaît plus : + devient ✕ et referme le menu, les onglets restent utilisables',
        'Créer : Importer, Vocal, Note (le plus près du pouce), icônes au trait dans leur couleur, sans légende',
        'Survol, appui et sélection animés de la même façon partout ; un choix se montre teinté et cerclé, jamais en noir',
        'Recherche : plus de « Tout », un filtre se retire en le touchant à nouveau',
        'Interrupteurs carrés avec ✓ ou −, comme le reste de l’interface ; nouveautés, corrections et améliorations marquées pareil partout',
        'Sur tablette, Réglages, À propos et Quoi de neuf s’ouvrent sur le côté du pouce ; l’accueil reste au centre',
        'Thème sombre : la barre du bas retrouve son verre sombre',
      ],
      fix: [
        'Dans une carte, les titres du texte ne dépassent plus le titre de la note',
        'Noms alignés : Corbeille, Sans dossier, Toutes les notes',
        'Le stockage se protège seul à l’installation et à chaque export',
      ],
    },
  },
  {
    date: '2026-10-19',
    changes: {
      new: [
        'Tablette, liste et note côte à côte : chaque volet garde ses îlots dans son coin, la navigation et + en bas à gauche, les outils de la note en bas à droite',
        'Le dossier de la note s’affiche au-dessus du titre : touchez-le pour la déplacer',
        'Plan, Historique et Vue d’ensemble s’ouvrent en panneau sur le côté du pouce, la note reste visible',
        'Réviser et Carte des liens s’ouvrent en plein écran',
      ],
      better: [
        'Le texte s’efface en douceur sous les outils au lieu de passer derrière',
        'Les menus laissent visible le bouton qui les a ouverts',
        'Les colonnes suivent la largeur du volet : deux à côté d’une note, trois en pleine largeur',
        'Téléphone à l’horizontale : mise en forme et outils sur une seule ligne',
        'Créer : icône, nom et détail alignés dans les trois choix, Note en jaune avec un crayon sombre',
        'Textes secondaires et coches ambrées plus lisibles en thème clair',
        'Recherche, messages et enregistrement se rangent du côté du pouce sur tablette',
      ],
      fix: [
        'Réduire la transparence et réduire les animations sont respectés partout',
        'Rien ne passe sous l’encoche d’un téléphone à l’horizontale',
        'Les cases à cocher des cartes sont plus faciles à toucher',
        'Supprimer, dans la sélection, retrouve un rouge lisible',
      ],
    },
  },
  {
    date: '2026-10-18',
    changes: {
      new: [
        'Note du jour dans Créer : rouvre celle d’aujourd’hui si elle existe',
        'Sous le titre d’une note : Plan, cartes à réviser et carte des liens en un geste',
      ],
      better: [
        'Les listes affichent une barre de progression sur leur carte',
        'Restaurer une version indique sa date',
      ],
    },
  },
  {
    date: '2026-10-18',
    changes: {
      better: [
        'Trier s’ouvre en liste déroulante sous le bouton, la page reste nette derrière',
        'En thème sombre, les barres sont en verre clair au lieu d’un bloc noir',
        'Filtrer retiré : la Recherche et la Bibliothèque filtrent déjà par photos, listes, dates…',
      ],
    },
  },
  {
    date: '2026-10-18',
    changes: {
      new: [
        '+ propose trois choix : Note, Vocal, Importer',
        'Une note vide propose : liste, carte à réviser, réunion, projet, fiche, journal du jour',
        'En haut : cartes ou liste et trier, en menu déroulant sous le bouton',
      ],
      better: [
        'Une seule barre en bas : Notes, Bibliothèque, Recherche, Réglages, avec + du côté de la main dominante ; regroupée de ce côté sur tablette',
        'Récap en mosaïque, fond flouté derrière les menus, barre de navigation plus lisible, trois colonnes de cartes sur tablette',
        'Guide « Comment utiliser » réécrit : raccourcis clairs, Entrée pour ajouter un élément à la liste',
      ],
    },
  },
  {
    date: '2026-10-18',
    changes: {
      new: [
        'Récap en haut de l’accueil : à venir, à réviser, à faire, photo récente, souvenir',
        'Bibliothèque en pleine page : vues en tuiles, dossiers illustrés, nuage d’étiquettes',
        'Couleurs système avec un sens fixe : rouge pour le micro et la suppression, orange pour les dates, vert pour les photos…',
      ],
      better: [
        'Sur tablette : cartes plus grandes, vue liste sur deux colonnes, menus ouverts à côté du bouton qui les appelle',
        'Interrupteurs et sélecteurs qui glissent ; petites animations aux coches et aux choix',
        'Sélection plus compacte ; les compteurs à zéro sont masqués',
      ],
      fix: ['La page se met à jour au rechargement, sans rester sur l’ancienne version'],
    },
  },
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
  { date: '2026-10-09', changes: { new: ['Numéros de version datés : année.mois.jour.n'] } },
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
export const findRelease = (v: string) => RELEASE_LIST.find(r => r.version === v || r.legacy === v);
export const releasesSince = (v: string) => {
  const r = findRelease(v);
  return r ? RELEASE_LIST.slice(0, RELEASE_LIST.indexOf(r)) : [];
};

/* ---------- Starter notes ---------- */
export const GUIDE_TITLE = 'Comment utiliser';
const WELCOME = `Notes garde vos idées, listes, photos et messages vocaux **sur cet appareil** : pas de compte, rien n’est envoyé sur le cloud, et tout fonctionne ==hors ligne==.

## Premiers pas
- [ ] Lire [[${GUIDE_TITLE}]]
- [ ] Créer une note avec **+**
- [ ] Ranger une note dans un dossier
- [ ] Exporter une première sauvegarde

## Bon à savoir
- La visite guidée, le guide et les nouveautés sont dans **Réglages → Aide**.
- Ajoutez Notes à l’écran d’accueil : elle s’ouvre comme une app et le navigateur ne peut plus effacer vos notes.

Bonne écriture !`;

const GUIDE = `# Créer
- **+** : **Note**, **Vocal** ou **Importer** (photo, PDF, Markdown, EPUB)
- Note vide : choisissez **Liste**, **Carte à réviser**, **Réunion**, **Projet** ou **Journal du jour**
- Collez une image ou un lien sur l’accueil : il devient une note

# Mettre en forme
Touchez le texte pour l’écrire ; il se met en forme quand vous sortez. **Aa**, en bas de la note, ouvre les outils :
- **H** titre (touchez encore : sous-titre, intertitre)
- **B** gras, **I** italique, surligneur ==surligné==
- Listes à puces, numérotées ou à cocher
- **[[ ]]** lien vers une autre note, comme [[Bienvenue]]
- **::** carte à réviser

**Entrée** ajoute un élément à la liste ; **Entrée** sur un élément vide termine la liste.

# Raccourcis clavier
Ctrl sur Windows, ⌘ sur Mac :
- Ctrl + B : gras · Ctrl + I : italique · Ctrl + Maj + H : surligner
- Ctrl + Maj + 7 / 8 / 9 : liste numérotée / à puces / à cocher
- Ctrl + K : lien · Ctrl + Maj + K : carte à réviser
- Ctrl + Alt + 1 / 2 / 3 : titres
- Sur l’accueil : **N** note, **L** liste, **D** journal du jour, **/** rechercher
- **Alt + ↑ / ↓** sur une note épinglée : la monter ou la descendre

# Organiser
- Glissez une note à droite : **épingler** ; à gauche : **supprimer**
- **Appui long** : sélectionner plusieurs notes (déplacer, fusionner, partager)
- **Clic droit** sur une note, à la souris : son menu
- **⋮** sur une note : épingler, déplacer, rappel, partager, masquer
- **Bibliothèque** : dossiers en couleur, #étiquettes, collections, Notes masquées (code PIN), corbeille

# Retrouver
**Recherche** lit aussi le texte des PDF et des photos. **Enregistrer** garde une recherche comme collection. En haut de l’accueil : cartes ou liste, et trier.

# Réviser
Une ligne « Question :: Réponse » devient une carte. **⋮ → Réviser** vous interroge au bon moment.

# Sauvegarder
Rien n’est envoyé sur le cloud : exportez parfois une sauvegarde (**Réglages → Exporter les notes**). Chaque note garde ses 10 dernières versions.`;

export const STARTER_NOTES: Pick<Note, 'title' | 'body'>[] = [
  { title: GUIDE_TITLE, body: GUIDE },
  { title: 'Bienvenue', body: WELCOME },
];

export const MSG = {
  trashed: 'Note placée dans la corbeille',
  folderExists: 'Ce dossier existe déjà.',
  badBackup: 'Fichier illisible : choisissez une sauvegarde .json exportée depuis Notes.',
} as const;
