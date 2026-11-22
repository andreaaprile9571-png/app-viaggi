import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Icon, OfflineBanner, Switch, TabBar } from '../../components/ui';
import { pairwiseTransfers, simplifiedTransfers } from '../../lib/balances';
import { dateLong, EXPENSE_CATEGORIES, money } from '../../lib/format';
import { t } from '../../lib/i18n';
import { useTrip } from '../../lib/TripContext';
import { supabase } from '../../lib/supabase';

export default function Expenses() {
  const { b, balances, stale, queued, memberName, refresh } = useTrip();
  const nav = useNavigate();
  const [cat, setCat] = useState<string>('tutte');
  const cur = b.trip.currency;
  const me = b.me;
  const total = b.expenses.reduce((a, e) => a + e.amount_base, 0);
  const myShare = b.shares.filter((s) => s.member_id === me?.id).reduce((a, s) => a + s.amount_base, 0);
  const myBal = me ? balances[me.id] ?? 0 : 0;
  const simplify = b.trip.simplify_debts;
  const nTransfers = simplify ? simplifiedTransfers(balances).length : pairwiseTransfers(b.expenses, b.shares, b.settlements).length;

  const list = useMemo(() => b.expenses.filter((e) => cat === 'tutte' || e.category === cat), [b.expenses, cat]);
  const byDay = useMemo(() => {
    const m = new Map<string, typeof list>();
    for (const e of list) m.set(e.spent_on, [...(m.get(e.spent_on) ?? []), e]);
    return [...m.entries()];
  }, [list]);

  async function setSimplify(v: boolean) {
    if (me?.role !== 'organizer') { alert('Solo l\'organizzatore può cambiare questa impostazione per il gruppo.'); return; }
    await supabase.from('trips').update({ simplify_debts: v }).eq('id', b.trip.id);
    refresh();
  }

  return (
    <div className="screen">
      <header className="col" style={{ gap: 2 }}>
        <p className="small muted">{b.trip.name}</p>
        <h1 className="display" style={{ fontSize: 30 }}>{t('Spese')}</h1>
      </header>
      <OfflineBanner stale={stale} queued={queued} />

      <section className="dark-card">
        <div className="between" style={{ alignItems: 'flex-start' }}>
          <div className="col"><span className="small" style={{ color: '#B5AC98' }}>{t('Totale del gruppo')}</span>
            <span className="display" style={{ fontSize: 30 }}>{money(total, cur)}</span></div>
          <div className="col" style={{ alignItems: 'flex-end' }}><span className="small" style={{ color: '#B5AC98' }}>{t('La tua quota')}</span>
            <span style={{ fontSize: 18, fontWeight: 600, paddingTop: 6 }}>{money(myShare, cur)}</span></div>
        </div>
        <Link to="saldi" className="between" style={{ minHeight: 48, padding: '0 14px', borderRadius: 14, background: '#fff', color: 'var(--ink)', textDecoration: 'none' }}>
          <span className="small">{myBal > 0.005 ? <>{t('Ti devono')} <strong style={{ color: 'var(--teal)' }}>{money(myBal, cur)}</strong></> : myBal < -0.005 ? <>{t('Devi dare')} <strong style={{ color: 'var(--orange-dark)' }}>{money(-myBal, cur)}</strong></> : t('Sei in pari')}</span>
          <span className="row small strong" style={{ color: 'var(--teal)', gap: 4 }}>{t('Vedi saldi')}<Icon name="chevron" size={16} /></span>
        </Link>
        <div className="row">
          <span className="col grow"><label htmlFor="simp" className="small strong">{t('Semplifica le spese')}</label>
            <span className="tiny" style={{ color: '#B5AC98' }}>{simplify ? `Calcolo automatico: ${nTransfers} pagamenti per pareggiare` : `Disattivo: ${nTransfers} rimborsi, uno per ogni debito`}</span></span>
          <Switch id="simp" checked={simplify} onChange={setSimplify} />
        </div>
      </section>

      <div className="chips" role="group" aria-label="Filtra per categoria">
        <button className="chip" aria-pressed={cat === 'tutte'} onClick={() => setCat('tutte')}>{t('Tutti')}</button>
        {EXPENSE_CATEGORIES.map((c) => <button key={c.id} className="chip" aria-pressed={cat === c.id} onClick={() => setCat(c.id)}>{t(c.label)}</button>)}
      </div>

      {byDay.map(([day, items]) => (
        <section key={day} className="stack" style={{ gap: 8 }}>
          <h2 className="small strong muted">{dateLong(day)}</h2>
          <ul className="list">
            {items.map((e) => {
              const c = EXPENSE_CATEGORIES.find((x) => x.id === e.category)!;
              const mine = b.shares.find((s) => s.expense_id === e.id && s.member_id === me?.id)?.amount_base ?? 0;
              return (
                <li key={e.id} style={{ padding: 0 }}>
                  <button className="linkcard" style={{ padding: '12px 0' }} onClick={() => nav(`nuova?id=${e.id}`)}>
                    <span className="icon-tile" style={{ width: 40, height: 40, borderRadius: 12, background: c.bg, color: c.fg, fontWeight: 700 }}>{e.title.charAt(0).toUpperCase()}</span>
                    <span className="col grow" style={{ gap: 2 }}>
                      <span className="row strong" style={{ gap: 6 }}><span className="ellipsis">{e.title}</span>{e.receipt_path && <Icon name="receipt" size={14} label="Scontrino allegato" className="muted" />}</span>
                      <span className="tiny muted">{t('Pagato da')} {memberName(e.paid_by)} · {t('La tua quota').toLowerCase()} {money(mine, cur)}</span>
                    </span>
                    <span className="col" style={{ alignItems: 'flex-end' }}>
                      <span className="strong">{money(e.amount, e.currency)}</span>
                      {e.currency !== cur && <span className="tiny muted">{money(e.amount_base, cur)}</span>}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
      {!list.length && <p className="empty">{t('Nessuna spesa ancora.')} Fotografa uno scontrino per iniziare.</p>}

      <Link to="nuova?scan=1" className="fab orange"><Icon name="camera" size={20} />{t('Scansiona scontrino')}</Link>
      <Link to="nuova" className="fab teal" style={{ bottom: 'calc(var(--tabbar) + 88px)', width: 56, padding: 0, justifyContent: 'center' }} aria-label={t('Nuova spesa')}><Icon name="plus" size={22} /></Link>
      <TabBar />
    </div>
  );
}
