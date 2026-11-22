import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { DOC_ICON, Icon, Sheet, toast, type IconName } from '../../components/ui';
import { dateLong, DOC_CATEGORIES, errorText } from '../../lib/format';
import { getLang, t } from '../../lib/i18n';
import { mapsLink } from '../../lib/integrations';
import { useTrip } from '../../lib/TripContext';
import { supabase, type ItineraryItem, type ItineraryKind, type TripDocument } from '../../lib/supabase';

type Stop =
  | { type: 'doc'; key: string; doc: TripDocument; at: Date; label?: string }
  | { type: 'item'; key: string; item: ItineraryItem; at: Date | null };

export const KINDS: { id: ItineraryKind; label: string; icon: IconName; bg: string; fg: string }[] = [
  { id: 'nota', label: 'Nota', icon: 'note', bg: '#E6E0D2', fg: '#45503F' },
  { id: 'attivita', label: 'Attività', icon: 'ticket', bg: '#F3DDD2', fg: '#9C4426' },
  { id: 'pasto', label: 'Pasto', icon: 'food', bg: '#FEF3C7', fg: '#92400E' },
  { id: 'spostamento', label: 'Spostamento', icon: 'train', bg: '#DCE7DE', fg: '#2F5D50' },
  { id: 'luogo', label: 'Luogo da vedere', icon: 'pin', bg: '#E0E9FF', fg: '#1D4ED8' },
];

const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const fmtTime = (d: Date) => new Intl.DateTimeFormat(getLang() === 'en' ? 'en-GB' : 'it-IT', { hour: '2-digit', minute: '2-digit' }).format(d);

type Draft = { id?: string; day: string; time: string; kind: ItineraryKind; text: string; place: string };

/** Il viaggio giorno per giorno: prenotazioni dai documenti più note, attività e luoghi aggiunti dal gruppo. */
export default function Itinerary() {
  const { b, refresh } = useTrip();
  const { trip } = b;
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);

  const { days, undated } = useMemo(() => {
    const stops: Stop[] = [];
    for (const d of b.documents) {
      if (!d.starts_at) continue;
      const start = new Date(d.starts_at);
      if (d.category === 'alloggi') {
        stops.push({ type: 'doc', key: `${d.id}-in`, doc: d, at: start, label: 'Check-in' });
        if (d.ends_at) stops.push({ type: 'doc', key: `${d.id}-out`, doc: d, at: new Date(d.ends_at), label: 'Check-out' });
      } else stops.push({ type: 'doc', key: d.id, doc: d, at: start });
    }
    const map = new Map<string, Stop[]>();
    if (trip.start_date && trip.end_date) {
      const cur = new Date(trip.start_date + 'T12:00:00');
      const end = new Date(trip.end_date + 'T12:00:00');
      for (let i = 0; cur <= end && i < 120; i++) { map.set(dayKey(cur), []); cur.setDate(cur.getDate() + 1); }
    }
    for (const s of stops) if (s.type === 'doc') map.set(dayKey(s.at), [...(map.get(dayKey(s.at)) ?? []), s]);
    for (const it of b.plan) {
      const at = it.at_time ? new Date(`${it.day}T${it.at_time}`) : null;
      map.set(it.day, [...(map.get(it.day) ?? []), { type: 'item', key: it.id, item: it, at }]);
    }
    // senza orario in cima (note del giorno), poi in ordine di orario
    for (const list of map.values()) list.sort((a, z) => (a.at ? a.at.getTime() : -Infinity) - (z.at ? z.at.getTime() : -Infinity));
    const days = [...map.entries()].sort(([a], [z]) => a.localeCompare(z));
    return { days, undated: b.documents.filter((d) => !d.starts_at && d.category !== 'personali') };
  }, [b.documents, b.plan, trip.start_date, trip.end_date]);

  const today = dayKey(new Date());
  const first = trip.start_date ? new Date(trip.start_date + 'T12:00:00') : null;
  const defaultDay = trip.start_date && today >= trip.start_date && (!trip.end_date || today <= trip.end_date) ? today : trip.start_date ?? today;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!draft || !b.me || !draft.text.trim() || !draft.day) return;
    setBusy(true);
    const row = { trip_id: trip.id, day: draft.day, at_time: draft.time || null, kind: draft.kind, text: draft.text.trim().slice(0, 500), place: draft.place.trim() || null };
    const { error } = draft.id
      ? await supabase.from('itinerary_items').update(row).eq('id', draft.id)
      : await supabase.from('itinerary_items').insert({ ...row, created_by: b.me.id });
    setBusy(false);
    if (error) { toast(errorText(error)); return; }
    setDraft(null); refresh();
  }
  async function remove() {
    if (!draft?.id || !confirm(t('Eliminare questa voce dall\'itinerario?'))) return;
    const { error } = await supabase.from('itinerary_items').delete().eq('id', draft.id);
    if (error) { toast(errorText(error)); return; }
    setDraft(null); refresh();
  }
  const edit = (it: ItineraryItem) => setDraft({ id: it.id, day: it.day, time: it.at_time?.slice(0, 5) ?? '', kind: it.kind, text: it.text, place: it.place ?? '' });

  return (
    <div className="screen no-tabs">
      <header className="between">
        <div className="row">
          <Link to=".." relative="path" className="icon-btn" aria-label={t('Indietro')}><Icon name="back" /></Link>
          <div className="col"><p className="small muted">{trip.name}</p><h1 className="display" style={{ fontSize: 28 }}>{t('Itinerario')}</h1></div>
        </div>
      </header>

      {!days.length && <p className="empty">{t('Aggiungi date ai documenti o una voce qui sotto per vedere il viaggio giorno per giorno.')}</p>}

      <ol className="timeline">
        {days.map(([day, stops]) => {
          const n = first ? Math.round((new Date(day + 'T12:00:00').getTime() - first.getTime()) / 86400000) + 1 : null;
          return (
            <li key={day} className={`tl-day${day === today ? ' today' : ''}`}>
              <div className="between">
                <h2 className="tl-head">
                  {n != null && n >= 1 && <span className="pill teal">{t('Giorno')} {n}</span>}
                  <span className="small strong">{dateLong(day)}</span>
                  {day === today && <span className="pill" style={{ background: 'var(--orange-soft)', color: 'var(--orange-dark)' }}>{t('Oggi')}</span>}
                </h2>
                <button className="icon-btn" style={{ width: 36, height: 36, minHeight: 36 }} onClick={() => setDraft({ day, time: '', kind: 'attivita', text: '', place: '' })} aria-label={`${t('Aggiungi al')} ${dateLong(day)}`}><Icon name="plus" size={18} /></button>
              </div>
              {stops.length ? (
                <ul className="tl-stops">
                  {stops.map((s) => {
                    if (s.type === 'doc') {
                      const c = DOC_CATEGORIES.find((x) => x.id === s.doc.category)!;
                      return (
                        <li key={s.key}>
                          <Link to={`../documenti/${s.doc.id}`} relative="path" className="tl-card">
                            <span className="tl-time">{fmtTime(s.at)}</span>
                            <span className="icon-tile" style={{ width: 36, height: 36, borderRadius: 10, background: c.bg, color: c.fg }}><Icon name={DOC_ICON[s.doc.category]} size={18} /></span>
                            <span className="col grow" style={{ minWidth: 0 }}>
                              <span className="small strong ellipsis">{s.label ? `${s.label} · ` : ''}{s.doc.title}</span>
                              {(s.doc.address || s.doc.ref_code) && <span className="tiny muted ellipsis">{[s.doc.ref_code, s.doc.address].filter(Boolean).join(' · ')}</span>}
                            </span>
                          </Link>
                        </li>
                      );
                    }
                    const k = KINDS.find((x) => x.id === s.item.kind) ?? KINDS[0];
                    return (
                      <li key={s.key}>
                        <button className="tl-card" onClick={() => edit(s.item)}>
                          <span className="tl-time">{s.at ? fmtTime(s.at) : ''}</span>
                          <span className="icon-tile" style={{ width: 36, height: 36, borderRadius: 10, background: k.bg, color: k.fg }}><Icon name={k.icon} size={18} /></span>
                          <span className="col grow" style={{ minWidth: 0 }}>
                            <span className="small" style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{s.item.text}</span>
                            {s.item.place && <span className="tiny muted ellipsis">{s.item.place}</span>}
                          </span>
                          {s.item.place && <a className="tiny strong" href={mapsLink(s.item.place)} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>{t('Mappa')}</a>}
                        </button>
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
          <ul className="rowlist">
            {undated.map((d) => <li key={d.id}><Link to={`../documenti/${d.id}`} relative="path" className="linkcard"><span className="grow small strong">{d.title}</span><Icon name="chevron" size={18} className="muted" /></Link></li>)}
          </ul>
        </section>
      )}

      <button className="fab teal" onClick={() => setDraft({ day: defaultDay, time: '', kind: 'nota', text: '', place: '' })}><Icon name="plus" size={20} />{t('Aggiungi')}</button>

      {draft && (
        <Sheet title={draft.id ? t('Modifica voce') : t('Nuova voce')} onClose={() => setDraft(null)}>
          <form className="stack" onSubmit={save}>
            <div className="chips" role="group" aria-label={t('Tipo')}>
              {KINDS.map((k) => <button key={k.id} type="button" className="chip teal" aria-pressed={draft.kind === k.id} onClick={() => setDraft({ ...draft, kind: k.id })} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Icon name={k.icon} size={16} />{t(k.label)}</button>)}
            </div>
            <div className="field"><label htmlFor="it-text">{draft.kind === 'nota' ? t('Nota') : t('Cosa')}</label>
              <textarea id="it-text" className="input" value={draft.text} onChange={(e) => setDraft({ ...draft, text: e.target.value })} maxLength={500} required
                placeholder={draft.kind === 'pasto' ? t('es. Cena da Zé da Mouraria') : draft.kind === 'luogo' ? t('es. Miradouro da Senhora do Monte al tramonto') : draft.kind === 'spostamento' ? t('es. Tram 28 fino a Graça') : t('es. Ritrovo alle 9 davanti all\'hotel')} /></div>
            <div className="pair">
              <div className="field"><label htmlFor="it-day">{t('Giorno')}</label><input id="it-day" className="input" type="date" value={draft.day} onChange={(e) => setDraft({ ...draft, day: e.target.value })} required /></div>
              <div className="field"><label htmlFor="it-time">{t('Ora')} <span className="tiny">{t('(facoltativo)')}</span></label><input id="it-time" className="input" type="time" value={draft.time} onChange={(e) => setDraft({ ...draft, time: e.target.value })} /></div>
            </div>
            <div className="field"><label htmlFor="it-place">{t('Luogo')} <span className="tiny">{t('(facoltativo)')}</span></label>
              <input id="it-place" className="input" value={draft.place} onChange={(e) => setDraft({ ...draft, place: e.target.value })} maxLength={200} placeholder={t('Si apre in Google Maps / Apple Mappe')} /></div>
            <button className="btn btn-teal btn-block" disabled={busy || !draft.text.trim()}>{busy ? t('Salvataggio…') : t('Salva')}</button>
            {draft.id && <button type="button" className="btn btn-danger btn-block" onClick={remove}><Icon name="trash" size={18} />{t('Elimina')}</button>}
          </form>
        </Sheet>
      )}
    </div>
  );
}
