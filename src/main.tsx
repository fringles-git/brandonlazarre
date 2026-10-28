import { Component, StrictMode, useEffect, useLayoutEffect, useSyncExternalStore, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { useShallow } from 'zustand/react/shallow';
import '@fontsource-variable/figtree';
import './styles/tokens.css';
import './styles/app.css';
import './styles/looks.css';
import { CONFIG } from './config';
import { releaseUrls } from './media';
import { set, useStore, type BeforeInstallPromptEvent } from './store';
import { checkTab, flushEditor, settled, toast } from './actions';
import { analyse, boot, persistStorage, updateBadge } from './features';
import { bindGestures } from './gestures';
import { Dock } from './ui/Dock';
import { Editor } from './ui/Editor';
import { FileInputs } from './ui/Files';
import { LayerHost } from './ui/Layers';
import { Library } from './ui/Library';
import { Header, InfoBar, NoteList, Recap } from './ui/List';
import { PrintArea, SheetHost, Toast } from './ui/Sheets';
import { Tour, Welcome } from './ui/Welcome';

const wide = matchMedia(CONFIG.splitMedia);
const useWide = () => useSyncExternalStore(cb => { wide.addEventListener('change', cb); return () => wide.removeEventListener('change', cb); }, () => wide.matches);

function registerServiceWorker() {
  if (!('serviceWorker' in navigator) || !isSecureContext || import.meta.env.DEV) return;
  navigator.serviceWorker.register(new URL('sw.js', location.href).href, { updateViaCache: 'none' }).then(reg => {
    document.addEventListener('visibilitychange', () => { if (!document.hidden) reg.update().catch(() => {}); });
    // Reload only once the note being written is saved: an update never costs a keystroke
    const offer = (w: ServiceWorker) => toast('Nouvelle version disponible.', async () => {
      if (!(await settled())) return toast('La note ouverte n’est pas enregistrée : mise à jour reportée.', () => offer(w), 'Réessayer');
      swap = true;
      w.postMessage('skip-waiting');
    }, 'Recharger', 'new');
    if (reg.waiting && navigator.serviceWorker.controller) offer(reg.waiting);
    reg.addEventListener('updatefound', () => {
      const w = reg.installing!;
      w.addEventListener('statechange', () => { if (w.state === 'installed' && navigator.serviceWorker.controller) offer(w); });
    });
  }).catch(() => {});
  // Reload only for an update the user accepted — never when the very first worker takes control (first visit)
  let swap = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (swap) { swap = false; location.reload(); } });
}

function useInstall() {
  useEffect(() => {
    const standalone = matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    set(s => ({ install: { ...s.install, ios, standalone } }));
    const onPrompt = (e: Event) => { e.preventDefault(); set(s => ({ install: { ...s.install, prompt: e as BeforeInstallPromptEvent } })); };
    const onInstalled = () => { set(s => ({ install: { ...s.install, prompt: null } })); toast('Notes est installée.'); };
    addEventListener('beforeinstallprompt', onPrompt);
    addEventListener('appinstalled', onInstalled);
    if (standalone) persistStorage();
    registerServiceWorker();
    return () => { removeEventListener('beforeinstallprompt', onPrompt); removeEventListener('appinstalled', onInstalled); };
  }, []);
}

/** The browser and system bars take the app's ground (--color-bg, so the look counts): for each scheme while the theme
    follows the device, the chosen one's for both otherwise. index.html's two tags carry the default look until then. */
function syncThemeColor() {
  const probe = document.body.appendChild(document.createElement('i'));
  probe.style.cssText = 'position: fixed; visibility: hidden; background: var(--color-bg)';
  for (const meta of document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')) {
    probe.style.colorScheme = document.documentElement.dataset.theme ?? (meta.media.includes('dark') ? 'dark' : 'light');
    meta.content = getComputedStyle(probe).backgroundColor;
  }
  probe.remove();
}

/** Mirrors preferences and modes onto <html>/<body> for CSS. */
function useDocumentState() {
  const s = useStore(useShallow(s => ({
    theme: s.prefs.theme, look: s.prefs.look ?? 'glass', accent: s.prefs.accent ?? 'amber', hand: s.prefs.hand, tint: s.prefs.tint, editing: s.editor.id !== null,
    selecting: s.selecting, searching: s.searchOpen, recording: s.recorder.on, layer: !!s.layer.mode || !!s.sheet, notes: s.notes,
    sheet: !!s.sheet || s.welcome,
  })));
  useLayoutEffect(() => {
    const root = document.documentElement, body = document.body;
    if (s.theme === 'auto') delete root.dataset.theme; else root.dataset.theme = s.theme;
    root.dataset.look = s.look;
    if (s.accent === 'amber') delete root.dataset.accent; else root.dataset.accent = s.accent;
    Object.assign(body.dataset, { hand: s.hand, tint: s.tint });
    body.classList.toggle('is-editing', s.editing);
    body.classList.toggle('is-selecting', s.selecting);
    body.classList.toggle('is-searching', s.searching);
    body.classList.toggle('is-recording', s.recording);
    body.classList.toggle('layer-open', s.layer);
    body.classList.toggle('sheet-open', s.sheet);
  });
  useEffect(syncThemeColor, [s.theme, s.look]);
  useEffect(() => {
    try { localStorage.setItem('notes:look', s.look); localStorage.setItem('notes:accent', s.accent); localStorage.setItem('notes:theme', s.theme); } catch { /* private mode: applies once the app loads */ }
  }, [s.look, s.accent, s.theme]);
  useEffect(() => { checkTab(); releaseUrls(s.notes); updateBadge(s.notes); }, [s.notes]);
}

function App() {
  useEffect(bindGestures, []);
  useInstall();
  useDocumentState();
  const isWide = useWide();
  const s = useStore(useShallow(s => ({ ready: s.ready, editing: s.editor.id !== null, sheet: s.sheet, page: s.page, welcome: s.welcome })));
  if (!s.ready) return null;
  const covered = (s.editing && !isWide) || !!s.sheet;
  return (
    <>
      {s.welcome && <div className="ambient" aria-hidden="true" />}
      <div className="page" inert={covered || undefined}>
        {s.page === 'library' ? <Library /> : <>
          <Header />
          <Recap />
          <InfoBar />
          <NoteList onShown={analyse} />
        </>}
      </div>
      <div inert={covered || undefined}><Dock /></div>
      <FileInputs />
      <Editor />
      <LayerHost />
      <SheetHost />
      <Welcome />
      <Tour />
      <Toast />
      <PrintArea />
    </>
  );
}

/** A drawing error never leaves a blank page: the notes are on disk (the open one is saved now), one tap reloads. */
class Recover extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { flushEditor(); }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main className="recover" role="alert">
        <h1>L’affichage s’est interrompu</h1>
        <p>Vos notes sont enregistrées sur cet appareil. Recharger rouvre Notes là où vous étiez.</p>
        <button className="btn primary" onClick={() => location.reload()}>Recharger</button>
      </main>
    );
  }
}

createRoot(document.getElementById('root')!).render(<StrictMode><Recover><App /></Recover></StrictMode>);
boot();
