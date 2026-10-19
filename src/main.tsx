import { StrictMode, useEffect, useLayoutEffect, useSyncExternalStore } from 'react';
import { createRoot } from 'react-dom/client';
import { useShallow } from 'zustand/react/shallow';
import '@fontsource-variable/figtree';
import './styles/tokens.css';
import './styles/app.css';
import { CONFIG } from './config';
import { releaseUrls } from './media';
import { set, useStore, type BeforeInstallPromptEvent } from './store';
import { checkTab, toast } from './actions';
import { analyse, boot, persistStorage } from './features';
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
    const offer = (w: ServiceWorker) => toast('Nouvelle version disponible.', () => w.postMessage('skip-waiting'), 'Recharger', 'new');
    if (reg.waiting && navigator.serviceWorker.controller) offer(reg.waiting);
    reg.addEventListener('updatefound', () => {
      const w = reg.installing!;
      w.addEventListener('statechange', () => { if (w.state === 'installed' && navigator.serviceWorker.controller) offer(w); });
    });
  }).catch(() => {});
  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (!reloaded) { reloaded = true; location.reload(); } });
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

/** Mirrors preferences and modes onto <html>/<body> for CSS. */
function useDocumentState() {
  const s = useStore(useShallow(s => ({
    theme: s.prefs.theme, hand: s.prefs.hand, tint: s.prefs.tint, font: s.prefs.font, editing: s.editor.id !== null,
    selecting: s.selecting, searching: s.searchOpen, recording: s.recorder.on, layer: !!s.layer.mode || !!s.sheet, notes: s.notes,
  })));
  useLayoutEffect(() => {
    const root = document.documentElement, body = document.body;
    if (s.theme === 'auto') delete root.dataset.theme; else root.dataset.theme = s.theme;
    Object.assign(body.dataset, { hand: s.hand, tint: s.tint, font: s.font });
    body.classList.toggle('is-editing', s.editing);
    body.classList.toggle('is-selecting', s.selecting);
    body.classList.toggle('is-searching', s.searching);
    body.classList.toggle('is-recording', s.recording);
    body.classList.toggle('layer-open', s.layer);
  });
  useEffect(() => { checkTab(); releaseUrls(s.notes); }, [s.notes]);
}

function App() {
  useEffect(bindGestures, []);
  useInstall();
  useDocumentState();
  const isWide = useWide();
  const s = useStore(useShallow(s => ({ ready: s.ready, editing: s.editor.id !== null, sheet: s.sheet, page: s.page })));
  if (!s.ready) return null;
  const covered = (s.editing && !isWide) || !!s.sheet;
  return (
    <>
      <div className="ambient" aria-hidden="true" />
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

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
boot();
