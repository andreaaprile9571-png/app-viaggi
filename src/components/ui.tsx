import { useEffect, useState, type ReactNode } from 'react';
import { NavLink, useParams } from 'react-router-dom';
import { t } from '../lib/i18n';
import type { Member } from '../lib/supabase';

type IconName = 'home' | 'doc' | 'receipt' | 'users' | 'plane' | 'bed' | 'train' | 'ticket' | 'shield' | 'id' | 'plus' | 'back' | 'close'
  | 'chevron' | 'search' | 'camera' | 'cloud-check' | 'lock' | 'copy' | 'share' | 'download' | 'check' | 'more' | 'calendar' | 'map'
  | 'sun' | 'cloud' | 'cloud-sun' | 'rain' | 'snow' | 'storm' | 'settings' | 'upload' | 'trash' | 'user-plus' | 'wallet' | 'folder' | 'mountain' | 'list' | 'chart' | 'route';

const P: Record<IconName, ReactNode> = {
  home: <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" />,
  doc: <><path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8z" /><path d="M14 3v5h5" /></>,
  receipt: <><path d="M5 3h14v18l-3-2-2 2-2-2-2 2-2-2-3 2z" /><path d="M9 8h6M9 12h6" /></>,
  users: <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c.8-3.5 3.4-5.5 6.5-5.5s5.7 2 6.5 5.5M16 4.5a3.5 3.5 0 0 1 0 7M18 14.5c1.9.6 3.1 2.4 3.5 5.5" /></>,
  plane: <path d="M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5z" />,
  bed: <><path d="M3 19V6M3 15h18v4M21 15v-2a3 3 0 0 0-3-3h-7v5" /><circle cx="7" cy="11.5" r="1.6" /></>,
  train: <><rect x="5" y="3" width="14" height="14" rx="3" /><path d="M5 11h14M8.5 21l2-4M15.5 21l-2-4" /></>,
  ticket: <><path d="M3 7h18v3a2 2 0 0 0 0 4v3H3v-3a2 2 0 0 0 0-4z" /><path d="M14 7v10" strokeDasharray="2 2" /></>,
  shield: <path d="M12 3l8 3v6c0 4.5-3.4 8-8 9-4.6-1-8-4.5-8-9V6z" />,
  id: <><rect x="3" y="5" width="18" height="14" rx="2" /><circle cx="9" cy="11" r="2" /><path d="M6 16c.6-1.4 1.7-2 3-2s2.4.6 3 2M14 10h4M14 13h3" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  back: <path d="M15 6l-6 6 6 6" />,
  close: <path d="M6 6l12 12M18 6 6 18" />,
  chevron: <path d="M9 6l6 6-6 6" />,
  search: <><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></>,
  camera: <><path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></>,
  'cloud-check': <><path d="M7 18a4.5 4.5 0 0 1-.6-9A6 6 0 0 1 18 9.5a4 4 0 0 1-1 8.5z" /><path d="M9.5 13.5l2 2 3.5-4" /></>,
  lock: <><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></>,
  copy: <><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3" /></>,
  share: <path d="M12 15V3M7 8l5-5 5 5M5 13v7h14v-7" />,
  download: <path d="M12 4v11M7 10l5 5 5-5M5 20h14" />,
  upload: <path d="M12 20V9M7 14l5-5 5 5M5 4h14" />,
  check: <path d="M5 12l5 5 9-10" />,
  more: <><circle cx="5" cy="12" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /></>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></>,
  map: <><path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2z" /><path d="M9 4v14M15 6v14" /></>,
  list: <><path d="M9 6h11M9 12h11M9 18h11" /><path d="m3.5 6 1.2 1.2L7 5M3.5 12l1.2 1.2L7 11M3.5 18l1.2 1.2L7 17" /></>,
  chart: <><path d="M4 20V10M10 20V4M16 20v-7M21 20H3" /></>,
  route: <><circle cx="6" cy="18" r="2.5" /><circle cx="18" cy="6" r="2.5" /><path d="M8.5 18H15a3.5 3.5 0 0 0 0-7H9a3.5 3.5 0 0 1 0-7h6.5" /></>,
  sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5 19 19M5 19l1.5-1.5M17.5 6.5 19 5" /></>,
  cloud: <path d="M7 18a4.5 4.5 0 0 1-.6-9A6 6 0 0 1 18 9.5a4 4 0 0 1-1 8.5z" />,
  'cloud-sun': <><path d="M8 19a4 4 0 0 1-.5-8A5 5 0 0 1 17 11a3.5 3.5 0 0 1-1 8z" /><path d="M15 3v1.5M20.5 5.5l-1 1M22 11h-1.5" /></>,
  rain: <><path d="M7 15a4.5 4.5 0 0 1-.6-9A6 6 0 0 1 18 6.5a4 4 0 0 1-1 8.5z" /><path d="M8 19l-1 2M12 19l-1 2M16 19l-1 2" /></>,
  snow: <><path d="M7 15a4.5 4.5 0 0 1-.6-9A6 6 0 0 1 18 6.5a4 4 0 0 1-1 8.5z" /><path d="M8 19h.01M12 20h.01M16 19h.01" /></>,
  storm: <><path d="M7 15a4.5 4.5 0 0 1-.6-9A6 6 0 0 1 18 6.5a4 4 0 0 1-1 8.5z" /><path d="M12 15l-2 4h4l-2 3" /></>,
  settings: <><circle cx="12" cy="12" r="3" /><path d="M19 12a7 7 0 0 0-.1-1.2l2-1.6-2-3.4-2.4 1a7 7 0 0 0-2-1.2L14 3h-4l-.5 2.6a7 7 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.6A7 7 0 0 0 5 12a7 7 0 0 0 .1 1.2l-2 1.6 2 3.4 2.4-1a7 7 0 0 0 2 1.2L10 21h4l.5-2.6a7 7 0 0 0 2-1.2l2.4 1 2-3.4-2-1.6c.1-.4.1-.8.1-1.2z" /></>,
  trash: <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" />,
  'user-plus': <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c.8-3.5 3.4-5.5 6.5-5.5s5.7 2 6.5 5.5M19 8v6M16 11h6" /></>,
  wallet: <><rect x="3" y="6" width="18" height="14" rx="2" /><path d="M3 10h18M16 15h2" /></>,
  folder: <path d="M3 6a1 1 0 0 1 1-1h5l2 2h9a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z" />,
  mountain: <><path d="M3 20l6-11 4 6 2-3 6 8z" /><circle cx="16" cy="6" r="2" /></>,
};

export function Icon({ name, size = 22, stroke = 1.9, label, className }: { name: IconName; size?: number; stroke?: number; label?: string; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke}
      strokeLinecap="round" strokeLinejoin="round" className={className}
      {...(label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true })}>
      {P[name]}
    </svg>
  );
}

export function Avatar({ m, large, size }: { m: Pick<Member, 'display_name' | 'color' | 'role'> & { avatar_url?: string | null }; large?: boolean; size?: number }) {
  const [broken, setBroken] = useState(false);
  const style: React.CSSProperties = { background: m.color, ...(size ? { width: size, height: size, borderRadius: size / 2, fontSize: Math.round(size * 0.4) } : {}) };
  return (
    <span className={`avatar${large ? ' lg' : ''}${m.role === 'guest' ? ' guest' : ''}`} style={style} title={m.display_name}>
      {m.avatar_url && !broken
        ? <img src={m.avatar_url} alt="" loading="lazy" onError={() => setBroken(true)} />
        : (m.display_name.trim().charAt(0).toUpperCase() || '?')}
    </span>
  );
}

export function Switch({ checked, onChange, id, label }: { checked: boolean; onChange: (v: boolean) => void; id?: string; label?: string }) {
  return (
    <button id={id} type="button" role="switch" aria-checked={checked} aria-label={label} className="switch" onClick={() => onChange(!checked)}>
      <span />
    </button>
  );
}

export function TabBar() {
  const { tripId } = useParams();
  const base = `/viaggio/${tripId}`;
  const tabs: [string, string, IconName][] = [
    [base, 'Panoramica', 'home'], [`${base}/documenti`, 'Documenti', 'doc'], [`${base}/spese`, 'Spese', 'receipt'], [`${base}/gruppo`, 'Gruppo', 'users'],
  ];
  return (
    <nav className="tabbar" aria-label={t('Sezioni del viaggio')}>
      {tabs.map(([to, label, icon]) => (
        <NavLink key={to} to={to} end className={({ isActive }) => (isActive ? 'active' : '')}>
          <Icon name={icon} size={24} />{t(label)}
        </NavLink>
      ))}
    </nav>
  );
}

// Quante finestre sono aperte: la pagina sotto resta ferma finché ce n'è almeno una.
let openSheets = 0;
function lockScroll(on: boolean) {
  openSheets = Math.max(0, openSheets + (on ? 1 : -1));
  document.documentElement.classList.toggle('sheet-open', openSheets > 0);
}

export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    lockScroll(true);
    return () => lockScroll(false);
  }, []);
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="between">
          <h2 style={{ fontSize: 18, fontWeight: 600 }}>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label={t('Chiudi')}><Icon name="close" size={20} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

let toastSetter: ((s: string | null) => void) | null = null;
export function toast(msg: string) { toastSetter?.(msg); }
export function ToastHost() {
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => { toastSetter = setMsg; return () => { toastSetter = null; }; }, []);
  useEffect(() => { if (!msg) return; const id = setTimeout(() => setMsg(null), 2600); return () => clearTimeout(id); }, [msg]);
  return msg ? <div className="toast" role="status">{msg}</div> : null;
}

export function OfflineBanner({ stale, queued }: { stale: boolean; queued: number }) {
  if (!stale && !queued) return null;
  return (
    <div className="banner gray" role="status">
      <Icon name="cloud" size={18} />
      <span className="grow">
        {stale && t('Sei offline: vedi i dati salvati sul telefono')}
        {stale && queued ? ' · ' : ''}
        {queued ? `${queued} ${t('spese in attesa di invio')}` : ''}
      </span>
    </div>
  );
}

export const DOC_ICON: Record<string, IconName> = {
  voli: 'plane', alloggi: 'bed', trasporti: 'train', attivita: 'ticket', assicurazione: 'shield', personali: 'id', altro: 'folder',
};

/** Marchio Evenkeel ("on an even keel"): due vele sopra uno scafo a "=", il gruppo che viaggia in equilibrio e torna pari. */
export function Logo({ size = 28, sail = 'var(--teal)', jib = 'var(--orange)', withName = false }: { size?: number; sail?: string; jib?: string; withName?: boolean }) {
  const mark = (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <path d="M33 5 L33 38 L55 38 Z" fill={sail} />
      <path d="M29 13 L29 38 L9 38 Z" fill={jib} />
      <rect x="8" y="44" width="48" height="6.5" rx="3.25" fill={sail} />
      <rect x="8" y="54" width="48" height="6.5" rx="3.25" fill={sail} />
    </svg>
  );
  if (!withName) return mark;
  return (
    <span className="row" style={{ gap: 8 }}>
      {mark}
      <span className="display" style={{ fontSize: Math.round(size * 0.8), color: 'var(--ink)' }}>{t("Evenkeel")}</span>
    </span>
  );
}
