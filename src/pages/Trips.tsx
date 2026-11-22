import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Avatar, Icon, Logo, Sheet } from '../components/ui';
import { loadTrips } from '../lib/api';
import { daysUntil, errorText, range } from '../lib/format';
import { t } from '../lib/i18n';
import type { Member, Trip } from '../lib/supabase';
import NewTripForm from './NewTrip';

export default function Trips({ name }: { name: string }) {
  const [data, setData] = useState<{ trips: Trip[]; members: Member[] } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [sheet, setSheet] = useState<'new' | 'join' | null>(null);
  const [code, setCode] = useState('');
  const nav = useNavigate();

  useEffect(() => { loadTrips().then(setData).catch((e) => setErr(errorText(e))); }, []);

  const groups = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const tr = data?.trips ?? [];
    const past = tr.filter((x) => x.end_date && x.end_date < today).reverse();
    const rest = tr.filter((x) => !past.includes(x));
    return { next: rest[0], upcoming: rest.slice(1), past };
  }, [data]);

  const membersOf = (id: string) => data?.members.filter((m) => m.trip_id === id) ?? [];

  return (
    <div className="screen no-tabs">
      <header className="between">
        <div className="col" style={{ gap: 2 }}>
          <Logo size={26} withName />
          <p className="muted small" style={{ marginTop: 10 }}>{t('Ciao')} {name}</p>
          <h1 className="display" style={{ fontSize: 32 }}>{t('I tuoi viaggi')}</h1>
        </div>
        <Link to="/impostazioni" className="icon-btn" aria-label={t('Impostazioni')}><Icon name="settings" /></Link>
      </header>

      {err && <p className="error">{err}</p>}
      {!data && !err && <p className="muted">Caricamento…</p>}

      {data && !data.trips.length && (
        <div className="card stack" style={{ padding: 24 }}>
          <h2 className="display" style={{ fontSize: 22 }}>Il primo viaggio parte da qui</h2>
          <p className="muted">Crea un viaggio e invita il gruppo, oppure entra con il codice che ti hanno mandato.</p>
        </div>
      )}

      {groups.next && (() => {
        const tr = groups.next; const ms = membersOf(tr.id); const d = daysUntil(tr.start_date);
        return (
          <Link to={`/viaggio/${tr.id}`} className="card" style={{ padding: 0, overflow: 'hidden', textDecoration: 'none', color: 'inherit', boxShadow: 'var(--shadow)' }}>
            <div style={{ background: tr.cover_color, color: '#fff', padding: 20, minHeight: 132, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', gap: 6, position: 'relative' }}>
              {d !== null && <span className="pill" style={{ position: 'absolute', top: 16, left: 20, background: 'rgba(255,255,255,.18)', color: '#fff' }}>
                {d > 0 ? `Prossimo · tra ${d} giorni` : d === 0 ? 'Si parte oggi' : t('In corso')}</span>}
              <h2 className="display" style={{ fontSize: 28 }}>{tr.name}</h2>
              <p className="small" style={{ opacity: .9 }}>{range(tr.start_date, tr.end_date)}</p>
            </div>
            <div className="between" style={{ padding: '16px 20px' }}>
              <div className="row" style={{ gap: 10 }}>
                <div className="avatars">{ms.slice(0, 5).map((m) => <Avatar key={m.id} m={m} />)}</div>
                <span className="small muted">{ms.length} {t('persone')}</span>
              </div>
              <Icon name="chevron" size={20} className="muted" />
            </div>
          </Link>
        );
      })()}

      {!!groups.upcoming.length && (
        <section className="stack">
          <h3 className="eyebrow">{t('In programma')}</h3>
          {groups.upcoming.map((tr) => <TripRow key={tr.id} tr={tr} n={membersOf(tr.id).length} />)}
        </section>
      )}
      {!!groups.past.length && (
        <section className="stack">
          <h3 className="eyebrow">{t('Passati')}</h3>
          {groups.past.map((tr) => <TripRow key={tr.id} tr={tr} n={membersOf(tr.id).length} />)}
        </section>
      )}

      <div className="bottom-bar">
        <div className="row">
          <button className="btn btn-ghost" onClick={() => setSheet('join')}>{t('Entra con un codice')}</button>
          <button className="btn btn-primary grow" onClick={() => setSheet('new')}><Icon name="plus" size={20} />{t('Nuovo viaggio')}</button>
        </div>
      </div>

      {sheet === 'new' && <Sheet title={t('Nuovo viaggio')} onClose={() => setSheet(null)}><NewTripForm name={name} /></Sheet>}
      {sheet === 'join' && (
        <Sheet title={t('Entra con un codice')} onClose={() => setSheet(null)}>
          <form className="stack" onSubmit={(e) => { e.preventDefault(); if (code.trim()) nav(`/j/${code.trim().toUpperCase()}`); }}>
            <div className="field"><label htmlFor="code">{t('Codice invito')}</label>
              <input id="code" className="input" value={code} onChange={(e) => setCode(e.target.value)} placeholder="es. 4K9A2B7C" autoCapitalize="characters" /></div>
            <button className="btn btn-primary btn-block" disabled={!code.trim()}>{t('Entra nel viaggio')}</button>
          </form>
        </Sheet>
      )}
    </div>
  );
}

function TripRow({ tr, n }: { tr: Trip; n: number }) {
  return (
    <Link to={`/viaggio/${tr.id}`} className="linkcard">
      <span className="icon-tile" style={{ width: 48, height: 48, background: tr.cover_color + '22', color: tr.cover_color }}><Icon name="mountain" /></span>
      <span className="col grow">
        <span className="strong">{tr.name}</span>
        <span className="small muted">{range(tr.start_date, tr.end_date)} · {n} {t('persone')}</span>
      </span>
      <Icon name="chevron" size={20} className="muted" />
    </Link>
  );
}
