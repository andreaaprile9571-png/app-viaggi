import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Avatar, Icon, toast } from '../../components/ui';
import { errorText } from '../../lib/format';
import { t } from '../../lib/i18n';
import { useTrip } from '../../lib/TripContext';
import { supabase, type ListItem, type ListName } from '../../lib/supabase';

const STARTER: Record<ListName, string[]> = {
  bagagli: ['Carta d\'identità o passaporto', 'Tessera sanitaria', 'Caricabatterie e power bank', 'Adattatore per prese', 'Medicine personali', 'Occhiali da sole', 'Costume e telo', 'Kit da bagno'],
  cose: ['Check-in online dei voli', 'Scaricare le mappe offline', 'Avvisare la banca del viaggio', 'Prenotare il transfer dall\'aeroporto', 'Controllare la scadenza dei documenti'],
};

/** Liste condivise del gruppo: bagagli e cose da fare, con spunta e persona incaricata. */
export default function Lists() {
  const { b, refresh } = useTrip();
  const [list, setList] = useState<ListName>('bagagli');
  const [text, setText] = useState('');
  const [who, setWho] = useState<string>('');
  const [busy, setBusy] = useState(false);
  const items = b.lists.filter((i) => i.list === list);
  const done = items.filter((i) => i.done).length;

  async function add(texts: string[]) {
    if (!b.me || !texts.length) return;
    setBusy(true);
    const { error } = await supabase.from('list_items').insert(texts.map((x) => ({ trip_id: b.trip.id, list, text: x.slice(0, 200), member_id: who || null, created_by: b.me!.id })));
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
          <div className="between small"><span className="muted">{done} / {items.length} {t('fatte')}</span></div>
          <div className="progress"><div style={{ width: `${Math.round((done / items.length) * 100)}%` }} /></div>
        </div>
      )}

      <form className="stack" onSubmit={(e) => { e.preventDefault(); if (text.trim()) add([text.trim()]); }}>
        <div className="row">
          <input className="input grow" value={text} onChange={(e) => setText(e.target.value)} placeholder={list === 'bagagli' ? t('es. Crema solare') : t('es. Prenotare il ristorante')} aria-label={t('Nuova voce')} maxLength={200} />
          <button className="btn btn-teal" disabled={busy || !text.trim()} aria-label={t('Aggiungi')}><Icon name="plus" size={20} /></button>
        </div>
        <div className="chips" role="group" aria-label={t('Per chi')}>
          <button type="button" className="chip teal" aria-pressed={who === ''} onClick={() => setWho('')}>{t('Tutti')}</button>
          {b.members.map((m) => <button key={m.id} type="button" className="chip teal" aria-pressed={who === m.id} onClick={() => setWho(m.id)}>{m.id === b.me?.id ? t('Io') : m.display_name}</button>)}
        </div>
      </form>

      {items.length ? (
        <ul className="list">
          {items.map((i) => {
            const m = member(i.member_id);
            return (
              <li key={i.id}>
                <input type="checkbox" id={`li-${i.id}`} checked={i.done} onChange={() => toggle(i)} style={{ width: 22, height: 22, margin: 0, accentColor: 'var(--teal)', flexShrink: 0 }} />
                <label htmlFor={`li-${i.id}`} className="grow small" style={{ minHeight: 44, display: 'flex', alignItems: 'center', textDecoration: i.done ? 'line-through' : 'none', color: i.done ? 'var(--muted)' : 'inherit' }}>{i.text}</label>
                {m && <Avatar m={m} />}
                <button className="icon-btn" onClick={() => remove(i)} aria-label={`${t('Elimina')} ${i.text}`}><Icon name="trash" size={18} /></button>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="card stack" style={{ alignItems: 'flex-start' }}>
          <p className="small muted">{list === 'bagagli' ? t('Nessun oggetto ancora. Parti da una lista base e modificala insieme al gruppo.') : t('Nessuna attività ancora. Parti da qualche promemoria utile.')}</p>
          <button className="btn btn-ghost" onClick={() => add(STARTER[list].map((x) => t(x)))} disabled={busy}><Icon name="list" size={18} />{t('Usa la lista base')}</button>
        </div>
      )}
    </div>
  );
}
