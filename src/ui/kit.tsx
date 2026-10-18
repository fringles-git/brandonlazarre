/** Shared building blocks: layers, rows, chips, inline forms, segmented controls, highlighted & formatted text. */
import { Fragment, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import type { Prefs } from '../types';
import { parseInline, parseLine, TAG, headingLevel } from '../markdown';
import { folderColor, useStore } from '../store';
import { setPref } from '../actions';
import { Icon } from './icons';

/** Keeps content mounted briefly after close, so it can animate out. */
function useExit<T>(value: T | null, ms = 200) {
  const [shown, setShown] = useState(value), [closing, setClosing] = useState(false);
  if (value !== null && value !== shown) { setShown(value); setClosing(false); }
  useEffect(() => {
    if (value !== null || shown === null) return;
    setClosing(true);
    const t = setTimeout(() => { setShown(null); setClosing(false); }, ms);
    return () => clearTimeout(t);
  }, [value, shown, ms]);
  return { shown: value ?? shown, closing };
}

/* The control that opened a layer: pointer target (Safari doesn't focus buttons on tap) or keyboard focus. */
let trigger: Element | null = null;
document.addEventListener('pointerdown', e => { trigger = (e.target as Element).closest('button, [role=button]'); }, true);
document.addEventListener('keydown', () => { trigger = document.activeElement; }, true);

/** Phone: bottom sheet under the thumb. Wider screens: a popover next to the control that opened it. */
function anchorTo(el: Element | null): CSSProperties | undefined {
  if (!el || !matchMedia('(min-width:40em)').matches) return;
  const r = el.getBoundingClientRect(), vw = document.documentElement.clientWidth, edge = 12, w = Math.min(380, vw - 2 * edge), gap = 8;
  if (!r.width) return;
  const left = Math.min(Math.max(edge, r.left + r.width / 2 - w / 2), vw - w - edge), below = r.top + r.height / 2 < innerHeight / 2;
  const origin = `${r.left + r.width / 2 - left}px ${below ? '0' : '100%'}`;
  return below
    ? { left, right: 'auto', width: w, top: r.bottom + gap, bottom: 'auto', maxHeight: innerHeight - r.bottom - gap - edge, transformOrigin: origin }
    : { left, right: 'auto', width: w, bottom: innerHeight - r.top + gap, maxHeight: r.top - gap - edge, transformOrigin: origin };
}

/** A glass panel with its own scrim. Focus moves in on open and back on close. */
export function Layer({ open, onClose, label, className, children, initialFocus, style, data, anchor = false }: {
  open: boolean; onClose: () => void; label: string; className: string; children: ReactNode; anchor?: boolean;
  initialFocus?: () => HTMLElement | null | undefined; style?: CSSProperties; data?: Record<string, string | undefined>;
}) {
  const { shown, closing } = useExit(open ? children : null), panel = useRef<HTMLDivElement>(null), back = useRef<Element | null>(null);
  const [placed, setPlaced] = useState<CSSProperties | undefined>();
  const mode = data?.['data-mode'];
  useLayoutEffect(() => {
    if (!open || !anchor) return setPlaced(undefined);
    // A layer opened from inside another keeps the first one's place
    if (trigger && (panel.current?.contains(trigger) || !trigger.isConnected)) return;
    setPlaced(anchorTo(trigger));
  }, [open, anchor, mode]);
  useLayoutEffect(() => {
    if (!open) return;
    back.current = trigger || document.activeElement;
    const el = initialFocus?.() || panel.current?.querySelector<HTMLElement>('input:not([type=hidden]), [data-autofocus]') || panel.current;
    el?.focus({ preventScroll: true });
    return () => { if (back.current instanceof HTMLElement && document.contains(back.current)) back.current.focus({ preventScroll: true }); };
  }, [open]);
  if (shown === null) return null;
  return (
    <>
      <div className="scrim" data-closing={closing || undefined} onClick={onClose} />
      <div ref={panel} className={className} role="dialog" aria-modal="true" aria-label={label} tabIndex={-1}
        data-open={open || undefined} data-closing={closing || undefined} data-anchored={placed ? '' : undefined} style={{ ...placed, ...style }} {...data}>
        {shown}
      </div>
    </>
  );
}

/** Zero counts are noise: never shown. */
export const shown = (v: ReactNode) => v != null && v !== '' && v !== 0 && v !== '0';

export function Row({ icon, label, trailing, onClick, pressed, color, tone, disabled, className = 'row' }: {
  icon?: ReactNode; label: ReactNode; trailing?: ReactNode; onClick?: () => void; pressed?: boolean; color?: number; tone?: string; disabled?: boolean; className?: string;
}) {
  return (
    <button className={className} onClick={onClick} aria-pressed={pressed} data-color={color} data-tone={tone} disabled={disabled}>
      {typeof icon === 'string' ? <Icon name={icon} /> : icon}
      <span className="row-label">{label}</span>
      {shown(trailing) && <small>{trailing}</small>}
    </button>
  );
}

export const Chip = ({ icon, label, onClick, aria, className = '' }: { icon: string; label: string; onClick: () => void; aria?: string; className?: string }) => (
  <button className={'chip ' + className} onClick={onClick} aria-label={aria}>
    <Icon name={icon} />
    <span>{label}</span>
  </button>
);

export function InlineForm({ onSubmit, button, autoFocus = true, inputProps }: {
  onSubmit: (value: string, input: HTMLInputElement) => void; button: string; autoFocus?: boolean; inputProps: React.InputHTMLAttributes<HTMLInputElement>;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { if (autoFocus) { ref.current?.focus(); ref.current?.select(); } }, [autoFocus]);
  const submit = () => onSubmit(ref.current!.value, ref.current!);
  return (
    <div className="inline-form">
      <input ref={ref} {...inputProps} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); submit(); } }} />
      <button onClick={submit} aria-label={button}><Icon name="check" /></button>
    </div>
  );
}

type PrefKey = 'view' | 'theme' | 'hand' | 'tint' | 'font';
export function Segmented<K extends PrefKey>({ pref, label, options }: { pref: K; label: string; options: [Prefs[K], ReactNode][] }) {
  const value = useStore(s => s.prefs[pref]), at = Math.max(0, options.findIndex(([v]) => v === value));
  return (
    <>
      <h4 id={'seg-' + pref}>{label}</h4>
      <div className="segmented" role="radiogroup" aria-labelledby={'seg-' + pref} style={{ '--i': at, '--n': options.length } as CSSProperties}>
        <span className="seg-thumb" aria-hidden="true" />
        {options.map(([v, text]) => (
          <button key={String(v)} role="radio" aria-checked={value === v} onClick={() => setPref(pref, v)}>{text}</button>
        ))}
      </div>
    </>
  );
}
/** On/off with a sliding knob. */
export const Switch = ({ on, label, note, onClick }: { on: boolean; label: string; note?: ReactNode; onClick: () => void }) => (
  <button className="option" role="switch" aria-checked={on} onClick={onClick}>
    <span>{label}{shown(note) && <small className="option-note">{note}</small>}</span>
    <span className="switch" aria-hidden="true"><i /></span>
  </button>
);
export function Option<K extends keyof Prefs>({ pref, value, label, note }: { pref: K; value: Prefs[K]; label: string; note?: string }) {
  const on = useStore(s => s.prefs[pref] === value);
  return (
    <button className="option" onClick={() => setPref(pref, value)} aria-pressed={on}>
      <span>{label}</span>
      {note && <small>{note}</small>}
    </button>
  );
}
export const THEMES: [Prefs['theme'], ReactNode][] = [
  ['auto', <><Icon name="themeAuto" />Auto</>], ['light', <><Icon name="themeLight" />Clair</>], ['dark', <><Icon name="themeDark" />Sombre</>],
];
export const HANDS: [Prefs['hand'], ReactNode][] = [['right', 'Droitier'], ['left', 'Gaucher']];

export function FolderTag({ folder }: { folder: string }) {
  const color = useStore(s => folderColor(folder, s.folderColors));
  return <span className="folder-tag" data-color={color}>{folder}</span>;
}

/* ---------- Text ---------- */
export function Highlight({ text, query }: { text: string; query: string }) {
  const q = query.trim();
  if (!q) return <>{text}</>;
  return <>{text.split(RegExp('(' + q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi')).map((p, i) => (i % 2 ? <mark key={i}>{p}</mark> : p))}</>;
}
function Tagged({ text, query }: { text: string; query: string }) {
  const parts: string[] = [];
  let last = 0;
  for (const m of text.matchAll(TAG)) {
    const at = m.index! + m[1].length;
    parts.push(text.slice(last, at), m[2]);
    last = at + 1 + m[2].length;
  }
  parts.push(text.slice(last));
  return <>{parts.map((p, i) => (i % 2
    ? <span key={i} className="md-tag" data-tag={p.toLowerCase()}><Highlight text={'#' + p} query={query} /></span>
    : <Highlight key={i} text={p} query={query} />))}</>;
}
const MARK_CLASS = { b: 'md-b', i: 'md-i', hl: 'md-hl', link: 'wiki-link' } as const;
function Inline({ text, query }: { text: string; query: string }) {
  return <>{parseInline(text).leaves.map((l, i) => {
    const inner = l.marks.includes('link') ? <Highlight text={l.text} query={query} /> : <Tagged text={l.text} query={query} />;
    return l.marks.length ? <span key={i} className={l.marks.map(m => MARK_CLASS[m]).join(' ')}>{inner}</span> : <Fragment key={i}>{inner}</Fragment>;
  })}</>;
}

/** Renders a note body; `lines` wraps each source line (for the editor's tap-to-edit). */
export function Formatted({ body, query = '', lines = false, onToggle }: { body: string; query?: string; lines?: boolean; onToggle?: (line: number, on: boolean) => void }) {
  const all = body.split('\n');
  let n = 0, prev = 'text';
  return <>{all.map((raw, i) => {
    const p = parseLine(raw), content = <Inline text={p.text} query={query} />;
    if (p.kind === 'number') n = prev === 'number' ? n + 1 : p.n;
    prev = p.kind;
    if (p.kind === 'check') {
      const done = /x/i.test(p.prefix);
      return (
        <div key={i} className="check" data-line={i} data-checked={+done}>
          <label className="check-hit"><input type="checkbox" checked={done} aria-label={p.text} onChange={e => onToggle?.(i, e.target.checked)} /></label>
          <span>{content}</span>
        </div>
      );
    }
    if (p.kind === 'bullet' || p.kind === 'number')
      return <div key={i} className={'md-li md-' + p.kind} data-line={i} data-n={p.kind === 'number' ? n : undefined}>{content}</div>;
    const block = headingLevel(p.kind) ? <span className={'md-h md-' + p.kind}>{content}</span> : content;
    return lines
      ? <div key={i} data-line={i}>{raw ? block : <br />}</div>
      : <Fragment key={i}>{block}{i < all.length - 1 ? '\n' : ''}</Fragment>;
  })}</>;
}
