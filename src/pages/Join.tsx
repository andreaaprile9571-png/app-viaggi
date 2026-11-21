import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { range } from '../lib/format';
import { t } from '../lib/i18n';
import { supabase } from '../lib/supabase';

type Preview = { trip_id: string; name: string; destination: string | null; start_date: string | null; end_date: string | null; members_count: number };

export default function Join({ name }: { name: string }) {
  const { code = '' } = useParams();
  const nav = useNavigate();
  const [p, setP] = useState<Preview | null | undefined>(undefined);
  const [guests, setGuests] = useState<{ member_id: string; display_name: string }[]>([]);
  const [asGuest, setAsGuest] = useState<string>('');
  const [display, setDisplay] = useState(name);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    supabase.rpc('invite_preview', { p_code: code }).then(({ data }) => setP((data as Preview[])?.[0] ?? null));
    supabase.rpc('invite_guests', { p_code: code }).then(({ data }) => setGuests((data as typeof guests) ?? []));
  }, [code]);

  async function join() {
    setErr(null);
    const { data, error } = await supabase.rpc('join_trip', { p_code: code, p_display_name: display.trim(), p_guest_member: asGuest || null });
    if (error) { setErr(error.message); return; }
    nav(`/viaggio/${data}`, { replace: true });
  }

  if (p === undefined) return <div className="screen no-tabs"><p className="muted">Caricamento…</p></div>;
  if (p === null) return <div className="screen no-tabs"><h1 className="display" style={{ fontSize: 26 }}>Invito non valido</h1><p className="muted">Il codice {code} non esiste o è stato rigenerato dall'organizzatore.</p></div>;

  return (
    <div className="screen no-tabs">
      <p className="eyebrow">Sei stato invitato</p>
      <div className="card stack" style={{ background: 'var(--teal)', color: '#fff', padding: 20 }}>
        <h1 className="display" style={{ fontSize: 28 }}>{p.name}</h1>
        <p className="small" style={{ opacity: .9 }}>{[p.destination, range(p.start_date, p.end_date)].filter(Boolean).join(' · ')}</p>
        <p className="small" style={{ opacity: .9 }}>{p.members_count} {t('persone')} nel gruppo</p>
      </div>
      {guests.length > 0 && (
        <div className="field"><label htmlFor="guest">Sei già nella lista come ospite?</label>
          <select id="guest" className="input" value={asGuest} onChange={(e) => setAsGuest(e.target.value)}>
            <option value="">No, entro come nuovo membro</option>
            {guests.map((g) => <option key={g.member_id} value={g.member_id}>Sì, sono {g.display_name}</option>)}
          </select></div>
      )}
      {!asGuest && (
        <div className="field"><label htmlFor="disp">Come ti chiameranno nel gruppo</label>
          <input id="disp" className="input" value={display} onChange={(e) => setDisplay(e.target.value)} maxLength={60} /></div>
      )}
      {err && <p className="error">{err}</p>}
      <div className="bottom-bar"><button className="btn btn-teal btn-block" onClick={join} disabled={!asGuest && !display.trim()}>{t('Entra nel viaggio')}</button></div>
    </div>
  );
}
