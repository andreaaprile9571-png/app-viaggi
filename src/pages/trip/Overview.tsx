import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Avatar, DOC_ICON, Icon, OfflineBanner, TabBar } from '../../components/ui';
import { dateShort, dateTime, DOC_CATEGORIES, money, range, relTime } from '../../lib/format';
import { t } from '../../lib/i18n';
import { weather, weatherLabel, type DayWeather } from '../../lib/integrations';
import { useTrip } from '../../lib/TripContext';
import CalendarSync from '../../components/CalendarSync';

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
  const openItems = b.lists.filter((i) => !i.done).length;
  const listsLabel = b.lists.length ? `${openItems} ${t('da fare')}` : t('Bagagli e cose da fare');
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

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
        <Link to="itinerario" className="linkcard" style={{ padding: 14 }}>
          <span className="icon-tile" style={{ width: 40, height: 40, background: 'var(--teal-soft)', color: 'var(--teal)' }}><Icon name="route" size={20} /></span>
          <span className="col" style={{ minWidth: 0 }}><span className="small strong">{t('Itinerario')}</span><span className="tiny muted">{t('Giorno per giorno')}</span></span>
        </Link>
        <Link to="liste" className="linkcard" style={{ padding: 14 }}>
          <span className="icon-tile" style={{ width: 40, height: 40, background: 'var(--orange-soft)', color: 'var(--orange-dark)' }}><Icon name="list" size={20} /></span>
          <span className="col" style={{ minWidth: 0 }}><span className="small strong">{t('Liste')}</span><span className="tiny muted">{listsLabel}</span></span>
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
          <p className="tiny muted">{t('Previsioni Open-Meteo, disponibili fino a 16 giorni prima.')}</p>
        </section>
      )}

      <section className="stack">
        <h2 className="eyebrow">{t('Calendario del viaggio')}</h2>
        <CalendarSync token={trip.calendar_token} tripName={trip.name} />
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
