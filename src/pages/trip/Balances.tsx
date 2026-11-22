import { Link } from 'react-router-dom';
import { Avatar, Icon, Switch, toast } from '../../components/ui';
import { pairwiseTransfers, simplifiedTransfers } from '../../lib/balances';
import { money } from '../../lib/format';
import { t } from '../../lib/i18n';
import { exportCsv, exportXlsx } from '../../lib/importexport';
import { paypalLink, whatsappLink } from '../../lib/integrations';
import { useTrip } from '../../lib/TripContext';
import { supabase } from '../../lib/supabase';

export default function Balances() {
  const { b, balances, refresh, memberName } = useTrip();
  const cur = b.trip.currency;
  const simplify = b.trip.simplify_debts;
  const transfers = simplify ? simplifiedTransfers(balances) : pairwiseTransfers(b.expenses, b.shares, b.settlements);
  const max = Math.max(1, ...Object.values(balances).map(Math.abs));
  const profileOf = (memberId: string) => {
    const uidOf = b.members.find((m) => m.id === memberId)?.user_id;
    return b.profiles.find((p) => p.id === uidOf);
  };

  async function markPaid(from: string, to: string, amount: number) {
    const { error } = await supabase.from('settlements').insert({ trip_id: b.trip.id, from_member: from, to_member: to, amount_base: amount, created_by: b.me?.id });
    if (error) { toast(error.message); return; }
    await supabase.from('activity').insert({ trip_id: b.trip.id, member_id: b.me?.id, kind: 'settlement', text: `ha segnato pagato: ${memberName(from)} → ${memberName(to)} · ${money(amount, cur)}` });
    toast('Pagamento registrato');
    refresh();
  }
  async function undo(id: string) { await supabase.from('settlements').delete().eq('id', id); refresh(); }
  async function setSimplify(v: boolean) {
    if (b.me?.role !== 'organizer') { toast('Solo l\'organizzatore può cambiarlo'); return; }
    await supabase.from('trips').update({ simplify_debts: v }).eq('id', b.trip.id); refresh();
  }

  const summary = [`Saldi di "${b.trip.name}":`, ...transfers.map((x) => `• ${memberName(x.from)} → ${memberName(x.to)}: ${money(x.amount, cur)}`)].join('\n');

  return (
    <div className="screen no-tabs">
      <header className="row">
        <Link to=".." relative="path" className="icon-btn" aria-label="Torna alle spese"><Icon name="back" /></Link>
        <h1 className="display" style={{ fontSize: 28 }}>{t('Saldi')}</h1>
      </header>

      <section className="list">
        {b.members.map((m) => {
          const v = balances[m.id] ?? 0;
          return (
            <li key={m.id} style={{ gap: 10 }}>
              <Avatar m={m} />
              <span className="ellipsis" style={{ width: 70 }}>{m.display_name}</span>
              <span className="grow row" style={{ gap: 0, height: 10 }} aria-hidden="true">
                <span className="grow" style={{ display: 'flex', justifyContent: 'flex-end' }}>{v < 0 && <span className="bar-neg" style={{ width: `${(-v / max) * 100}%` }} />}</span>
                <span style={{ width: 2, height: 16, background: '#C8BFAC' }} />
                <span className="grow" style={{ display: 'flex' }}>{v > 0 && <span className="bar-pos" style={{ width: `${(v / max) * 100}%` }} />}</span>
              </span>
              <span className="col" style={{ alignItems: 'flex-end', width: 92 }}>
                <span className="strong" style={{ color: v > 0.005 ? 'var(--teal)' : v < -0.005 ? 'var(--orange-dark)' : 'var(--muted)' }}>{v > 0 ? '+ ' : v < 0 ? '− ' : ''}{money(Math.abs(v), cur)}</span>
                <span className="tiny muted">{v > 0.005 ? t('deve ricevere') : v < -0.005 ? t('deve dare') : 'in pari'}</span>
              </span>
            </li>
          );
        })}
      </section>

      <section className="card row">
        <span className="col grow"><label htmlFor="simp" className="strong small">{t('Semplifica le spese')}</label>
          <span className="tiny muted">{simplify ? 'Calcolo automatico: chi deve dare paga direttamente chi deve ricevere' : 'Disattivo: un rimborso per ogni debito tra due persone'}</span></span>
        <Switch id="simp" checked={simplify} onChange={setSimplify} />
      </section>

      <section className="stack">
        <div className="between"><h2 className="eyebrow">{t('Per pareggiare i conti')}</h2><span className="tiny muted">{transfers.length ? `${transfers.length} pagamenti da fare` : t('Tutto saldato')}</span></div>
        <ul className="list">
          {transfers.map((x) => {
            const p = profileOf(x.to);
            return (
              <li key={`${x.from}-${x.to}`} style={{ flexWrap: 'wrap' }}>
                <span className="grow"><strong>{x.from === b.me?.id ? 'Tu' : memberName(x.from)}</strong> {t('dà a')} <strong>{x.to === b.me?.id ? 'te' : memberName(x.to)}</strong></span>
                <span className="display" style={{ fontSize: 18 }}>{money(x.amount, cur)}</span>
                <span className="row" style={{ width: '100%', gap: 8 }}>
                  {x.from === b.me?.id && p?.paypal_me && <a className="btn btn-ghost" style={{ minHeight: 40 }} href={paypalLink(p.paypal_me, x.amount, cur)} target="_blank" rel="noreferrer">PayPal</a>}
                  {x.from === b.me?.id && p?.iban && <button className="btn btn-ghost" style={{ minHeight: 40 }} onClick={() => { navigator.clipboard.writeText(p.iban!); toast('IBAN copiato'); }}>{t('Copia IBAN')}</button>}
                  <button className="btn btn-teal grow" style={{ minHeight: 40 }} onClick={() => markPaid(x.from, x.to, x.amount)}><Icon name="check" size={16} />{t('Segna come pagato')}</button>
                </span>
              </li>
            );
          })}
          {!transfers.length && <li className="small muted">Nessun pagamento da fare.</li>}
        </ul>
      </section>

      {!!b.settlements.length && (
        <section className="stack">
          <h2 className="eyebrow">Pagamenti registrati</h2>
          <ul className="list">
            {[...b.settlements].reverse().map((s) => (
              <li key={s.id}><Icon name="check" size={18} className="muted" />
                <span className="grow small">{memberName(s.from_member)} → {memberName(s.to_member)}</span>
                <span className="small strong">{money(s.amount_base, cur)}</span>
                <button className="btn btn-ghost" style={{ minHeight: 36, padding: '0 10px', fontSize: 13 }} onClick={() => undo(s.id)}>Annulla</button></li>
            ))}
          </ul>
        </section>
      )}

      <div className="stack">
        <a className="btn btn-ghost btn-block" href={whatsappLink(summary)} target="_blank" rel="noreferrer">{t('Condividi su WhatsApp')}</a>
        <div className="row">
          <button className="btn btn-ghost grow" onClick={() => exportCsv(b)}><Icon name="download" size={18} />{t('Esporta CSV')}</button>
          <button className="btn btn-ghost grow" onClick={() => exportXlsx(b, b.members.map((m) => ({ Persona: m.display_name, Saldo: balances[m.id] ?? 0 })))}><Icon name="download" size={18} />{t('Esporta Excel')}</button>
        </div>
        <p className="tiny muted">Il file Excel si apre anche in Google Sheets (File › Importa).</p>
      </div>
    </div>
  );
}
