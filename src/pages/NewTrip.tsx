import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CURRENCIES } from '../lib/format';
import { getLang, t } from '../lib/i18n';
import { searchPlaces, type Place } from '../lib/integrations';
import { supabase } from '../lib/supabase';

const COLORS = ['#2F5D50', '#1D4ED8', '#6D28D9', '#9C4426', '#22302A', '#BE185D'];

export default function NewTripForm({ name }: { name: string }) {
  const nav = useNavigate();
  const [title, setTitle] = useState('');
  const [dest, setDest] = useState('');
  const [place, setPlace] = useState<Place | null>(null);
  const [options, setOptions] = useState<Place[]>([]);
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [currency, setCurrency] = useState('EUR');
  const [color, setColor] = useState(COLORS[0]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (place && place.label === dest) return;
    const id = setTimeout(() => { searchPlaces(dest, getLang()).then(setOptions).catch(() => setOptions([])); }, 300);
    return () => clearTimeout(id);
  }, [dest, place]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(null);
    const { data, error } = await supabase.rpc('create_trip', {
      p_name: title.trim(), p_destination: place?.label ?? (dest.trim() || null), p_lat: place?.lat ?? null, p_lon: place?.lon ?? null,
      p_start: start || null, p_end: end || start || null, p_currency: currency, p_display_name: name, p_color: color,
    });
    setBusy(false);
    if (error) { setErr(error.message); return; }
    nav(`/viaggio/${data}`);
  }

  return (
    <form className="stack" onSubmit={create}>
      <div className="field"><label htmlFor="t-name">Nome del viaggio</label>
        <input id="t-name" className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="es. Lisbona & Porto" maxLength={120} required /></div>
      <div className="field" style={{ position: 'relative' }}><label htmlFor="t-dest">{t('Destinazione')}</label>
        <input id="t-dest" className="input" value={dest} onChange={(e) => { setDest(e.target.value); setPlace(null); }} placeholder="Città o luogo" autoComplete="off" />
        {!place && options.length > 0 && (
          <ul className="list" style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 5, boxShadow: 'var(--shadow)', marginTop: 4 }}>
            {options.map((o) => (
              <li key={`${o.lat},${o.lon}`} style={{ padding: 0 }}>
                <button type="button" className="linkcard" style={{ padding: '12px 0' }} onClick={() => { setPlace(o); setDest(o.label); setOptions([]); }}>{o.label}</button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="row">
        <div className="field grow"><label htmlFor="t-start">{t('Dal')}</label><input id="t-start" className="input" type="date" value={start} onChange={(e) => setStart(e.target.value)} /></div>
        <div className="field grow"><label htmlFor="t-end">{t('Al')}</label><input id="t-end" className="input" type="date" value={end} min={start} onChange={(e) => setEnd(e.target.value)} /></div>
      </div>
      <div className="field"><label htmlFor="t-cur">{t('Valuta')} del viaggio</label>
        <select id="t-cur" className="input" value={currency} onChange={(e) => setCurrency(e.target.value)}>{CURRENCIES.map((c) => <option key={c}>{c}</option>)}</select></div>
      <div className="field"><span className="label">Colore della copertina</span>
        <div className="row" role="group" aria-label="Colore">{COLORS.map((c) => (
          <button key={c} type="button" aria-label={c} aria-pressed={color === c} onClick={() => setColor(c)}
            style={{ width: 40, height: 40, borderRadius: 20, background: c, border: color === c ? '3px solid #fff' : 'none', boxShadow: color === c ? `0 0 0 2px ${c}` : 'none', cursor: 'pointer' }} />
        ))}</div></div>
      {err && <p className="error">{err}</p>}
      <button className="btn btn-primary btn-block" disabled={!title.trim() || busy}>{busy ? '…' : t('Crea viaggio')}</button>
    </form>
  );
}
