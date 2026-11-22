import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { DOC_ICON, Icon } from '../../components/ui';
import { dateLong, DOC_CATEGORIES } from '../../lib/format';
import { getLang, t } from '../../lib/i18n';
import { useTrip } from '../../lib/TripContext';
import type { TripDocument } from '../../lib/supabase';

type Stop = { key: string; doc: TripDocument; at: Date; label?: string };

const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const time = (d: Date) => new Intl.DateTimeFormat(getLang() === 'en' ? 'en-GB' : 'it-IT', { hour: '2-digit', minute: '2-digit' }).format(d);

/** Il viaggio giorno per giorno: voli, check-in, check-out e attività in ordine di orario. */
export default function Itinerary() {
  const { b } = useTrip();
  const { trip } = b;

  const { days, undated } = useMemo(() => {
    const stops: Stop[] = [];
    for (const d of b.documents) {
      if (!d.starts_at) continue;
      const start = new Date(d.starts_at);
      if (d.category === 'alloggi') {
        stops.push({ key: `${d.id}-in`, doc: d, at: start, label: 'Check-in' });
        if (d.ends_at) stops.push({ key: `${d.id}-out`, doc: d, at: new Date(d.ends_at), label: 'Check-out' });
      } else stops.push({ key: d.id, doc: d, at: start });
    }
    stops.sort((a, z) => a.at.getTime() - z.at.getTime());
    const map = new Map<string, Stop[]>();
    // tutti i giorni del viaggio, anche quelli senza prenotazioni
    if (trip.start_date && trip.end_date) {
      const cur = new Date(trip.start_date + 'T12:00:00');
      const end = new Date(trip.end_date + 'T12:00:00');
      for (let i = 0; cur <= end && i < 120; i++) { map.set(dayKey(cur), []); cur.setDate(cur.getDate() + 1); }
    }
    for (const s of stops) map.set(dayKey(s.at), [...(map.get(dayKey(s.at)) ?? []), s]);
    const days = [...map.entries()].sort(([a], [z]) => a.localeCompare(z));
    return { days, undated: b.documents.filter((d) => !d.starts_at && d.category !== 'personali') };
  }, [b.documents, trip.start_date, trip.end_date]);

  const today = dayKey(new Date());
  const first = trip.start_date ? new Date(trip.start_date + 'T12:00:00') : null;

  return (
    <div className="screen no-tabs">
      <header className="row">
        <Link to=".." relative="path" className="icon-btn" aria-label={t('Indietro')}><Icon name="back" /></Link>
        <div className="col"><p className="small muted">{trip.name}</p><h1 className="display" style={{ fontSize: 28 }}>{t('Itinerario')}</h1></div>
      </header>

      {!days.length && <p className="empty">{t('Aggiungi date ai documenti (voli, alloggi, attività) per vedere qui il viaggio giorno per giorno.')}</p>}

      <ol className="timeline">
        {days.map(([day, stops]) => {
          const n = first ? Math.round((new Date(day + 'T12:00:00').getTime() - first.getTime()) / 86400000) + 1 : null;
          return (
            <li key={day} className={`tl-day${day === today ? ' today' : ''}`}>
              <h2 className="tl-head">
                {n != null && n >= 1 && <span className="pill teal">{t('Giorno')} {n}</span>}
                <span className="small strong">{dateLong(day)}</span>
                {day === today && <span className="pill" style={{ background: 'var(--orange-soft)', color: 'var(--orange-dark)' }}>{t('Oggi')}</span>}
              </h2>
              {stops.length ? (
                <ul className="tl-stops">
                  {stops.map((s) => {
                    const c = DOC_CATEGORIES.find((x) => x.id === s.doc.category)!;
                    return (
                      <li key={s.key}>
                        <Link to={`../documenti/${s.doc.id}`} relative="path" className="linkcard" style={{ padding: '10px 12px' }}>
                          <span className="tiny strong" style={{ width: 44, color: 'var(--muted)' }}>{time(s.at)}</span>
                          <span className="icon-tile" style={{ width: 36, height: 36, borderRadius: 10, background: c.bg, color: c.fg }}><Icon name={DOC_ICON[s.doc.category]} size={18} /></span>
                          <span className="col grow" style={{ minWidth: 0 }}>
                            <span className="small strong ellipsis">{s.label ? `${s.label} · ` : ''}{s.doc.title}</span>
                            {(s.doc.address || s.doc.ref_code) && <span className="tiny muted ellipsis">{[s.doc.ref_code, s.doc.address].filter(Boolean).join(' · ')}</span>}
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              ) : <p className="tiny muted" style={{ padding: '2px 0 6px' }}>{t('Giornata libera')}</p>}
            </li>
          );
        })}
      </ol>

      {!!undated.length && (
        <section className="stack">
          <h2 className="eyebrow">{t('Senza data')}</h2>
          <ul className="list">
            {undated.map((d) => <li key={d.id}><Link to={`../documenti/${d.id}`} relative="path" className="grow small" style={{ color: 'inherit', textDecoration: 'none', minHeight: 40, display: 'flex', alignItems: 'center' }}>{d.title}</Link></li>)}
          </ul>
        </section>
      )}
    </div>
  );
}
