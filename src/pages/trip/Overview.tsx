import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Avatar, DOC_ICON, Icon, OfflineBanner, TabBar } from '../../components/ui';
import { dateShort, dateTime, DOC_CATEGORIES, money, range, relTime } from '../../lib/format';
import { t } from '../../lib/i18n';
import { weather, weatherLabel, type DayWeather } from '../../lib/integrations';
import { useTrip } from '../../lib/TripContext';
import { SUPABASE_URL } from '../../lib/supabase';

export default function Overview() {
  const { b, balances, stale, queued, memberName } = useTrip();
  const { trip, me } = b;
  const [wx, setWx] = useState<DayWeather[]>([]);

  useEffect(() => {
    if (trip.dest_lat != null && trip.dest_lon != null) weather(trip.dest_lat, trip.dest_lon).then(setWx).catch(() => setWx([]));
  }, [trip.dest_lat, trip.dest_lon]);

  const next = useMemo(() => {
    const now = Date.now() - 3 * 3600000;
    const mine = new Set(b.assignees.filter((a) => a.member_id === me?.id).map((a) => a.document_id));
    const upcoming = b.documents.filter((d) => d.starts_at && new Date(d.starts_at).getTime() > now);
    return upcoming.find((d) => mine.has(d.id)) ?? upcoming[0];
  }, [b, me]);

  const total = b.expenses.reduce((a, e) => a + e.amount_base, 0);
  const myBal = me ? balances[me.id] ?? 0 : 0;
  const tripDays = wx.filter((d) => (!trip.start_date || d.date >= trip.start_date) && (!trip.end_date || d.date <= trip.end_date));
  const days = tripDays.length ? tripDays : wx.slice(0, 7);
  const calUrl = `${SUPABASE_URL.replace('https://', 'webcal://')}/functions/v1/calendar?token=${trip.calendar_token}`;
  const cat = next ? DOC_CATEGORIES.find((c) => c.id === next.category)! : null;

  return (
    <div className="screen flush-top">
      <div className="hero" style={{ background: trip.cover_color }}>
        <div className="between">
          <Link to="/" className="icon-btn on-dark" aria-label="Torna ai viaggi"><Icon name="back" /></Link>
          <Link to="gruppo" className="btn" style={{ background: '#fff', color: trip.cover_color, minHeight: 44, borderRadius: 22, fontSize: 14 }}><Icon name="user-plus" size={18} />{t('Invita')}</Link>
        </div>
        <div className="col">
          <h1 className="display" style={{ fontSize: 30 }}>{trip.name}</h1>
          <p className="small" style={{ opacity: .9 }}>{[range(trip.start_date, trip.end_date), trip.destination].filter(Boolean).join(' · ')}</p>
          <div className="avatars" style={{ marginTop: 6 }}>{b.members.map((m) => <Avatar key={m.id} m={m} />)}</div>
        </div>
      </div>

      <OfflineBanner stale={stale} queued={queued} />

      <section className="stack">
        <h2 className="eyebrow">{t('Il tuo prossimo documento')}</h2>
        {next && cat ? (
          <Link to={`documenti/${next.id}`} className="card stack" style={{ textDecoration: 'none', color: 'inherit' }}>
            <div className="row">
              <span className="icon-tile" style={{ background: cat.bg, color: cat.fg }}><Icon name={DOC_ICON[next.category]} /></span>
              <span className="col grow"><span className="strong">{next.title}</span><span className="small muted">{dateTime(next.starts_at)}{next.ref_code ? ` · ${next.ref_code}` : ''}</span></span>
            </div>
          </Link>
        ) : (
          <Link to="documenti" className="card small muted" style={{ textDecoration: 'none' }}>Nessun documento con data in arrivo. Aggiungi biglietti e prenotazioni →</Link>
        )}
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
        <Link to="documenti" className="card col" style={{ textDecoration: 'none', color: 'inherit', gap: 8 }}>
          <span className="small muted">{t('Documenti')}</span>
          <span className="display" style={{ fontSize: 26 }}>{b.documents.length}</span>
        </Link>
        <Link to="spese" className="card col" style={{ textDecoration: 'none', color: 'inherit', gap: 8 }}>
          <span className="small muted">{t('Spese del gruppo')}</span>
          <span className="display" style={{ fontSize: 24 }}>{money(total, trip.currency)}</span>
          <span className="tiny strong" style={{ color: myBal > 0.005 ? 'var(--teal)' : myBal < -0.005 ? 'var(--orange-dark)' : 'var(--muted)' }}>
            {myBal > 0.005 ? `${t('Ti devono')} ${money(myBal, trip.currency)}` : myBal < -0.005 ? `${t('Devi dare')} ${money(-myBal, trip.currency)}` : t('Sei in pari')}
          </span>
        </Link>
      </div>

      {days.length > 0 && (
        <section className="stack">
          <h2 className="eyebrow">{t('Meteo a destinazione')}</h2>
          <div className="weather">
            {days.map((d) => { const w = weatherLabel(d.code); return (
              <div key={d.date}><span className="muted">{dateShort(d.date)}</span><Icon name={w.icon as 'sun'} size={22} label={w.text} /><span className="strong">{d.max}°</span><span className="muted">{d.min}°</span></div>
            ); })}
          </div>
          <p className="tiny muted">Previsioni Open-Meteo, disponibili fino a 16 giorni prima.</p>
        </section>
      )}

      <section className="stack">
        <h2 className="eyebrow">{t('Calendario del viaggio')}</h2>
        <div className="card row">
          <span className="icon-tile" style={{ background: 'var(--blue-soft)', color: 'var(--blue)' }}><Icon name="calendar" /></span>
          <span className="col grow"><span className="strong small">Voli, alloggi e attività nel tuo calendario</span><span className="tiny muted">Google, Apple e Outlook · si aggiorna da solo</span></span>
        </div>
        <div className="row">
          <a className="btn btn-ghost grow" href={calUrl}>Apple / Outlook</a>
          <a className="btn btn-ghost grow" href={`https://calendar.google.com/calendar/render?cid=${encodeURIComponent(calUrl)}`} target="_blank" rel="noreferrer">Google Calendar</a>
        </div>
      </section>

      <section className="stack">
        <h2 className="eyebrow">{t('Attività recenti')}</h2>
        <ul className="list">
          {b.activity.slice(0, 8).map((a) => {
            const m = b.members.find((x) => x.id === a.member_id);
            return (
              <li key={a.id}>
                {m ? <Avatar m={m} /> : <span className="avatar" style={{ background: '#C8BFAC' }}>?</span>}
                <span className="grow small"><strong>{memberName(a.member_id)}</strong> {a.text}</span>
                <span className="tiny muted">{relTime(a.created_at)}</span>
              </li>
            );
          })}
          {!b.activity.length && <li className="small muted">Ancora nessuna attività.</li>}
        </ul>
      </section>
      <TabBar />
    </div>
  );
}
