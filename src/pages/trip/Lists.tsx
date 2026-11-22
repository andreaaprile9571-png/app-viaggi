import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Avatar, Icon, toast } from '../../components/ui';
import { errorText } from '../../lib/format';
import { t } from '../../lib/i18n';
import { useTrip } from '../../lib/TripContext';
import { supabase, type ListItem, type ListName } from '../../lib/supabase';

/** Sezioni di ogni lista, nell'ordine in cui si mostrano. "Altro" raccoglie il resto. */
export const SECTIONS: Record<ListName, string[]> = {
  bagagli: ['Documenti', 'Vestiti', 'Intimo e notte', 'Calzature', 'Igiene e cura', 'Salute', 'Elettronica', 'Accessori', 'Altro'],
  cose: ['Prenotazioni', 'Documenti', 'Soldi e pagamenti', 'Controlli', 'Casa', 'Altro'],
};

const STARTER: Record<ListName, [string, string][]> = {
  bagagli: [
    ['Documenti', 'Carta d\'identità o passaporto'], ['Documenti', 'Tessera sanitaria'],
    ['Vestiti', 'Magliette'], ['Vestiti', 'Pantaloni'], ['Vestiti', 'Felpa o giacca'],
    ['Intimo e notte', 'Intimo'], ['Intimo e notte', 'Calze'], ['Intimo e notte', 'Pigiama'],
    ['Calzature', 'Scarpe comode'], ['Calzature', 'Ciabatte'],
    ['Igiene e cura', 'Spazzolino e dentifricio'], ['Igiene e cura', 'Crema solare'],
    ['Salute', 'Medicine personali'],
    ['Elettronica', 'Caricabatterie e power bank'], ['Elettronica', 'Adattatore per prese'],
    ['Accessori', 'Occhiali da sole'],
  ],
  cose: [
    ['Prenotazioni', 'Check-in online dei voli'], ['Prenotazioni', 'Prenotare il transfer dall\'aeroporto'],
    ['Documenti', 'Controllare la scadenza dei documenti'],
    ['Soldi e pagamenti', 'Avvisare la banca del viaggio'],
    ['Controlli', 'Scaricare le mappe offline'],
    ['Casa', 'Chiudere acqua e gas'],
  ],
};

/** Liste condivise del gruppo, divise per sezione: bagagli e cose da fare, con spunta e persona incaricata. */
export default function Lists() {
  const { b, refresh } = useTrip();
  const [list, setList] = useState<ListName>('bagagli');
  const [text, setText] = useState('');
  const [who, setWho] = useState<string>('');
  const [section, setSection] = useState<Record<ListName, string>>({ bagagli: 'Vestiti', cose: 'Prenotazioni' });
  const [busy, setBusy] = useState(false);
  const [hideDone, setHideDone] = useState(false);
  const items = b.lists.filter((i) => i.list === list);
  const done = items.filter((i) => i.done).length;
  const sections = SECTIONS[list];
  const groups = sections
    .map((s) => ({ s, rows: items.filter((i) => (sections.includes(i.section ?? '') ? i.section : 'Altro') === s && (!hideDone || !i.done)) }))
    .filter((g) => g.rows.length);

  async function add(rows: [string, string][]) {
    if (!b.me || !rows.length) return;
    setBusy(true);
    const { error } = await supabase.from('list_items').insert(rows.map(([sec, x]) => ({ trip_id: b.trip.id, list, section: sec, text: x.slice(0, 200), member_id: who || null, created_by: b.me!.id })));
    setBusy(false);
    if (error) { toast(errorText(error)); return; }
    setText(''); refresh();
  }
  async function toggle(i: ListItem) {
    const { error } = await supabase.from('list_items').update({ done: !i.done }).eq('id', i.id);
    if (error) toast(errorText(error)); else refresh();
  }
  async function remove(i: ListItem) {
    const { error } = await supabase.from('list_items').delete().eq('id', i.id);
    if (error) toast(errorText(error)); else refresh();
  }
  const member = (id: string | null) => b.members.find((m) => m.id === id);

  return (
    <div className="screen no-tabs">
      <header className="row">
        <Link to=".." relative="path" className="icon-btn" aria-label={t('Indietro')}><Icon name="back" /></Link>
        <div className="col"><p className="small muted">{b.trip.name}</p><h1 className="display" style={{ fontSize: 28 }}>{t('Liste')}</h1></div>
      </header>

      <div className="segmented" role="group" aria-label={t('Lista')}>
        <button aria-pressed={list === 'bagagli'} onClick={() => setList('bagagli')}>{t('Bagagli')}</button>
        <button aria-pressed={list === 'cose'} onClick={() => setList('cose')}>{t('Cose da fare')}</button>
      </div>

      {!!items.length && (
        <div className="stack" style={{ gap: 6 }}>
          <div className="between small">
            <span className="muted">{done} / {items.length} {t('fatte')}</span>
            {!!done && <button className="small" style={{ background: 'none', border: 'none', color: 'var(--teal)', padding: 0, minHeight: 32 }} onClick={() => setHideDone((v) => !v)}>{hideDone ? t('Mostra le fatte') : t('Nascondi le fatte')}</button>}
          </div>
          <div className="progress"><div style={{ width: `${Math.round((done / items.length) * 100)}%` }} /></div>
        </div>
      )}

      <form className="card stack" onSubmit={(e) => { e.preventDefault(); if (text.trim()) add([[section[list], text.trim()]]); }}>
        <div className="row">
          <input className="input grow" value={text} onChange={(e) => setText(e.target.value)} placeholder={list === 'bagagli' ? t('es. Crema solare') : t('es. Prenotare il ristorante')} aria-label={t('Nuova voce')} maxLength={200} />
          <button className="btn btn-teal" disabled={busy || !text.trim()} aria-label={t('Aggiungi')}><Icon name="plus" size={20} /></button>
        </div>
        <div className="field"><span className="label">{t('Sezione')}</span>
          <div className="chips" role="group" aria-label={t('Sezione')}>
            {sections.map((s) => <button key={s} type="button" className="chip teal" aria-pressed={section[list] === s} onClick={() => setSection({ ...section, [list]: s })}>{t(s)}</button>)}
          </div></div>
        <div className="field"><span className="label">{t('Per chi')}</span>
          <div className="chips" role="group" aria-label={t('Per chi')}>
            <button type="button" className="chip teal" aria-pressed={who === ''} onClick={() => setWho('')}>{t('Tutti')}</button>
            {b.members.map((m) => <button key={m.id} type="button" className="chip teal" aria-pressed={who === m.id} onClick={() => setWho(m.id)}>{m.id === b.me?.id ? t('Io') : m.display_name}</button>)}
          </div></div>
      </form>

      {groups.map(({ s, rows }) => {
        const left = rows.filter((r) => !r.done).length;
        return (
          <section key={s} className="stack" style={{ gap: 8 }}>
            <h2 className="between"><span className="eyebrow">{t(s)}</span><span className="tiny muted">{left ? `${left} ${t('da fare')}` : '✓'}</span></h2>
            <ul className="list">
              {rows.map((i) => {
                const m = member(i.member_id);
                return (
                  <li key={i.id} style={{ padding: '6px 0' }}>
                    <input type="checkbox" id={`li-${i.id}`} checked={i.done} onChange={() => toggle(i)} style={{ width: 22, height: 22, margin: 0, accentColor: 'var(--teal)', flexShrink: 0 }} />
                    <label htmlFor={`li-${i.id}`} className="grow small" style={{ minHeight: 44, display: 'flex', alignItems: 'center', textDecoration: i.done ? 'line-through' : 'none', color: i.done ? 'var(--muted)' : 'inherit' }}>{i.text}</label>
                    {m && <Avatar m={m} />}
                    <button className="icon-btn" onClick={() => remove(i)} aria-label={`${t('Elimina')} ${i.text}`}><Icon name="trash" size={18} /></button>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}

      {!items.length && (
        <div className="card stack" style={{ alignItems: 'flex-start' }}>
          <p className="small muted">{list === 'bagagli' ? t('Nessun oggetto ancora. Parti da una lista base e modificala insieme al gruppo.') : t('Nessuna attività ancora. Parti da qualche promemoria utile.')}</p>
          <button className="btn btn-ghost" onClick={() => add(STARTER[list].map(([sec, x]) => [sec, t(x)]))} disabled={busy}><Icon name="list" size={18} />{t('Usa la lista base')}</button>
        </div>
      )}
    </div>
  );
}
