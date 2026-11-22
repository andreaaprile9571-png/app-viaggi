import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import QRCode from 'qrcode';
import { Avatar, Icon, Sheet, TabBar, toast } from '../../components/ui';
import { splitEqual } from '../../lib/balances';
import { money, uid, errorText } from '../../lib/format';
import { t, tf } from '../../lib/i18n';
import { parseImport, type ImportedExpense } from '../../lib/importexport';
import { fxRate, whatsappLink } from '../../lib/integrations';
import { useTrip } from '../../lib/TripContext';
import { supabase } from '../../lib/supabase';

const COLORS = ['#6D28D9', '#1D4ED8', '#9C4426', '#2F5D50', '#B45309', '#BE185D', '#0369A1'];
export const APP_URL = (import.meta.env.VITE_PUBLIC_URL as string) || (window.location.origin + import.meta.env.BASE_URL).replace(/\/$/, '');

export default function Group() {
  const { b, refresh } = useTrip();
  const nav = useNavigate();
  const [qr, setQr] = useState('');
  const [guest, setGuest] = useState('');
  const [importing, setImporting] = useState<{ source: string; expenses: ImportedExpense[]; people: string[] } | null>(null);
  const [busy, setBusy] = useState(false);
  const link = `${APP_URL}/j/${b.trip.invite_code}`;
  const isOrg = b.me?.role === 'organizer';

  useEffect(() => { QRCode.toDataURL(link, { margin: 1, width: 240, color: { dark: '#22302A' } }).then(setQr); }, [link]);

  async function addGuest(e: React.FormEvent) {
    e.preventDefault();
    const name = guest.trim();
    if (!name) return;
    const { error } = await supabase.from('members').insert({ trip_id: b.trip.id, display_name: name, role: 'guest', color: COLORS[b.members.length % COLORS.length] });
    if (error) { toast(error.message); return; }
    setGuest(''); refresh();
  }
  async function removeMember(id: string, name: string) {
    if (!confirm(tf('Rimuovere {nome} dal viaggio?', { nome: name }))) return;
    const { error } = await supabase.from('members').delete().eq('id', id);
    if (error) toast(t("Non si può rimuovere chi ha spese o quote registrate")); else refresh();
  }
  async function rotate() {
    if (!confirm(t("Il vecchio link smetterà di funzionare. Continuare?"))) return;
    await supabase.rpc('rotate_trip_secrets', { p_trip: b.trip.id, p_what: 'invite' }); refresh();
  }
  async function leave() {
    if (!b.me || !confirm(t("Uscire da questo viaggio?"))) return;
    const { error } = await supabase.from('members').delete().eq('id', b.me.id);
    if (error) toast(t("Hai spese registrate: chiedi all'organizzatore di rimuoverti dopo aver saldato")); else nav('/');
  }
  async function deleteTrip() {
    if (!confirm(t("Eliminare il viaggio con tutti i documenti e le spese per tutto il gruppo? Non si può annullare."))) return;
    await supabase.from('trips').delete().eq('id', b.trip.id); nav('/');
  }

  async function onImportFile(f?: File) {
    if (!f) return;
    const res = parseImport(await f.text());
    if (!res.expenses.length) { toast(t("File non riconosciuto: usa l'export CSV di Splitwise o Tricount")); return; }
    setImporting(res);
  }
  async function runImport() {
    if (!importing) return;
    setBusy(true);
    try {
      const byName = new Map(b.members.map((m) => [m.display_name.toLowerCase(), m.id]));
      for (const p of importing.people) {
        if (byName.has(p.toLowerCase())) continue;
        const { data, error } = await supabase.from('members').insert({ trip_id: b.trip.id, display_name: p.slice(0, 60), role: 'guest', color: COLORS[byName.size % COLORS.length] }).select('id').single();
        if (error) throw error;
        byName.set(p.toLowerCase(), data.id);
      }
      for (const e of importing.expenses) {
        const rate = e.currency === b.trip.currency ? 1 : await fxRate(e.currency, b.trip.currency, e.date).catch(() => 1);
        const base = Math.round(e.amount * rate * 100) / 100;
        const ids = Object.keys(e.shares).map((n) => byName.get(n.toLowerCase())!).filter(Boolean);
        const shareSum = Object.values(e.shares).reduce((a, v) => a + v, 0);
        const shares = Math.abs(shareSum - e.amount) < 0.02
          ? Object.entries(e.shares).map(([n, v]) => ({ member_id: byName.get(n.toLowerCase())!, amount_base: Math.round(v * rate * 100) / 100 }))
          : Object.entries(splitEqual(base, ids)).map(([id, v]) => ({ member_id: id, amount_base: v }));
        const { error } = await supabase.rpc('save_expense', {
          p_expense: { trip_id: b.trip.id, title: e.title.slice(0, 160), amount: e.amount, currency: e.currency, rate, amount_base: base,
            paid_by: byName.get(e.payer.toLowerCase()), category: 'altro', spent_on: e.date, split_mode: 'amounts', client_id: uid() },
          p_shares: shares,
        });
        if (error) throw error;
      }
      toast(tf('Importate {n} spese', { n: importing.expenses.length }));
      setImporting(null); refresh();
    } catch (e) { toast(errorText(e)); }
    finally { setBusy(false); }
  }

  return (
    <div className="screen">
      <header className="col" style={{ gap: 2 }}>
        <p className="small muted">{b.trip.name}</p>
        <h1 className="display" style={{ fontSize: 30 }}>{t('Gruppo')}</h1>
      </header>

      <section className="card row" style={{ alignItems: 'center', gap: 16 }}>
        {qr ? <img src={qr} alt={tf('QR code per entrare nel viaggio, codice {codice}', { codice: b.trip.invite_code })} className="qr" /> : <span className="qr" />}
        <div className="col grow" style={{ gap: 8, minWidth: 0 }}>
          <span className="strong">{t('Invita con link o QR')}</span>
          <span className="small muted" style={{ overflowWrap: 'anywhere' }}>{t("Codice")} <strong style={{ color: 'var(--ink)', letterSpacing: 1 }}>{b.trip.invite_code}</strong></span>
          <button className="btn btn-teal" style={{ minHeight: 44 }} onClick={() => { navigator.clipboard.writeText(link); toast(t('Copiato')); }}>{t('Copia link')}</button>
          <div className="row" style={{ gap: 8 }}>
            <a className="btn btn-ghost grow" style={{ minHeight: 44, padding: '0 10px' }} href={whatsappLink(tf('Entra nel viaggio "{viaggio}": {link}', { viaggio: b.trip.name, link }))} target="_blank" rel="noreferrer">{t("WhatsApp")}</a>
            {'share' in navigator && <button className="icon-btn" aria-label={t("Condividi il link")} onClick={() => navigator.share({ title: b.trip.name, url: link })}><Icon name="share" size={18} /></button>}
          </div>
        </div>
      </section>
      {isOrg && <button className="btn btn-ghost" style={{ alignSelf: 'flex-start', minHeight: 36, fontSize: 13 }} onClick={rotate}>{t("Rigenera codice d'invito")}</button>}

      <section className="stack">
        <h2 className="eyebrow">{b.members.length} {t('persone')} {t("nel viaggio")}</h2>
        <ul className="list">
          {b.members.map((m) => (
            <li key={m.id}>
              <Avatar m={m} large />
              <span className="col grow"><span>{m.display_name}{m.id === b.me?.id ? ` (${t('tu')})` : ''}</span>
                <span className="tiny muted">{m.role === 'organizer' ? t('Organizzatore') : m.role === 'guest' ? t('Ospite · senza account') : t('Membro')}</span></span>
              {m.role === 'guest' && <a className="btn btn-ghost" style={{ minHeight: 36, fontSize: 13, padding: '0 12px' }} href={whatsappLink(tf('Ciao {nome}! Entra nel viaggio "{viaggio}" e scegli "sono {nome}": {link}', { nome: m.display_name, viaggio: b.trip.name, link }))} target="_blank" rel="noreferrer">{t("Invia link")}</a>}
              {isOrg && m.id !== b.me?.id && <button className="icon-btn" aria-label={tf('Rimuovi {nome}', { nome: m.display_name })} onClick={() => removeMember(m.id, m.display_name)}><Icon name="close" size={16} /></button>}
            </li>
          ))}
        </ul>
      </section>

      <form className="field" onSubmit={addGuest}>
        <label htmlFor="guest">{t('Aggiungi un ospite senza account (solo per le spese)')}</label>
        <div className="row"><input id="guest" className="input" value={guest} onChange={(e) => setGuest(e.target.value)} placeholder={t("Nome, es. Luca")} maxLength={60} />
          <button className="btn btn-primary" disabled={!guest.trim()}>{t('Aggiungi')}</button></div>
      </form>

      <section className="stack">
        <h2 className="eyebrow">{t("Strumenti")}</h2>
        <label className="linkcard" style={{ position: 'relative' }}>
          <span className="icon-tile" style={{ background: 'var(--orange-soft)', color: 'var(--orange)' }}><Icon name="upload" /></span>
          <span className="col grow"><span className="strong">{t('Importa da Splitwise o Tricount')}</span><span className="tiny muted">{t("Carica il file CSV esportato dall'altra app")}</span></span>
          <input type="file" accept=".csv,text/csv" style={{ position: 'absolute', opacity: 0, inset: 0, cursor: 'pointer' }} onChange={(e) => onImportFile(e.target.files?.[0])} />
        </label>
        <button className="btn btn-ghost" onClick={leave}>{t("Esci dal viaggio")}</button>
        {isOrg && <button className="btn btn-danger" onClick={deleteTrip}><Icon name="trash" size={18} />{t("Elimina viaggio")}</button>}
      </section>

      {importing && (
        <Sheet title={t("Importa spese")} onClose={() => setImporting(null)}>
          <p className="small">{t("Trovate")} <strong>{importing.expenses.length} {t("spese")}</strong> {t("da")} {importing.source === 'splitwise' ? 'Splitwise' : 'Tricount'}{t(", per un totale di")} {money(importing.expenses.reduce((a, e) => a + e.amount, 0), importing.expenses[0]?.currency || 'EUR')}.</p>
          <p className="small">{t("Persone:")} {importing.people.join(', ')}{t(". Chi non è già nel gruppo viene aggiunto come ospite.")}</p>
          <button className="btn btn-teal btn-block" onClick={runImport} disabled={busy}>{busy ? 'Importazione…' : 'Importa'}</button>
        </Sheet>
      )}
      <TabBar />
    </div>
  );
}
