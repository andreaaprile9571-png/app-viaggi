import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Icon, OfflineBanner, Sheet, Switch, TabBar, toast } from '../../components/ui';
import { pairwiseTransfers, simplifiedTransfers } from '../../lib/balances';
import { dateLong, errorText, EXPENSE_CATEGORIES, money } from '../../lib/format';
import { t, tf } from '../../lib/i18n';
import { useTrip } from '../../lib/TripContext';
import { supabase } from '../../lib/supabase';

export default function Expenses() {
  const { b, balances, stale, queued, memberName, refresh } = useTrip();
  const nav = useNavigate();
  const [cat, setCat] = useState<string>('tutte');
  const [q, setQ] = useState('');
  const [onlyMine, setOnlyMine] = useState(false);
  const [editBudget, setEditBudget] = useState(false);
  const [budgetStr, setBudgetStr] = useState('');
  const cur = b.trip.currency;
  const me = b.me;
  const total = b.expenses.reduce((a, e) => a + e.amount_base, 0);
  const myShare = b.shares.filter((s) => s.member_id === me?.id).reduce((a, s) => a + s.amount_base, 0);
  const myBal = me ? balances[me.id] ?? 0 : 0;
  const simplify = b.trip.simplify_debts;
  const nTransfers = simplify ? simplifiedTransfers(balances).length : pairwiseTransfers(b.expenses, b.shares, b.settlements).length;

  const budget = b.trip.budget ?? null;
  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const mineIds = new Set(b.shares.filter((s) => s.member_id === me?.id && s.amount_base > 0).map((s) => s.expense_id));
    return b.expenses.filter((e) => (cat === 'tutte' || e.category === cat)
      && (!onlyMine || e.paid_by === me?.id || mineIds.has(e.id))
      && (!needle || e.title.toLowerCase().includes(needle) || memberName(e.paid_by).toLowerCase().includes(needle) || String(e.amount).includes(needle)));
  }, [b.expenses, b.shares, cat, q, onlyMine, me?.id, memberName]);
  const listTotal = list.reduce((a, e) => a + e.amount_base, 0);

  async function saveBudget(e: React.FormEvent) {
    e.preventDefault();
    const v = budgetStr.trim() ? Number(budgetStr.replace(/\./g, '').replace(',', '.')) : null;
    if (v !== null && !(v > 0)) { toast(t('Inserisci un importo valido')); return; }
    const { error } = await supabase.from('trips').update({ budget: v }).eq('id', b.trip.id);
    if (error) { toast(errorText(error)); return; }
    setEditBudget(false); refresh();
  }
  const byDay = useMemo(() => {
    const m = new Map<string, typeof list>();
    for (const e of list) m.set(e.spent_on, [...(m.get(e.spent_on) ?? []), e]);
    return [...m.entries()];
  }, [list]);

  async function setSimplify(v: boolean) {
    if (me?.role !== 'organizer') { alert(t("Solo l'organizzatore può cambiare questa impostazione per il gruppo.")); return; }
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
        {budget ? (
          <button className="col" style={{ gap: 6, background: 'none', border: 'none', color: 'inherit', padding: 0, textAlign: 'left' }} onClick={() => { if (me?.role === 'organizer') { setBudgetStr(String(budget)); setEditBudget(true); } }}>
            <span className="between tiny" style={{ color: '#D3C9B5' }}><span>{t('Budget')} {money(budget, cur)}</span><span>{total > budget ? `${t('Superato di')} ${money(total - budget, cur)}` : `${t('Restano')} ${money(budget - total, cur)}`}</span></span>
            <span className="bar on-dark" aria-hidden="true"><span style={{ width: `${Math.min(100, (total / budget) * 100)}%`, background: total > budget ? '#F09A74' : '#9FD3BF' }} /></span>
          </button>
        ) : me?.role === 'organizer' && (
          <button className="small" style={{ background: 'none', border: 'none', color: '#9FD3BF', padding: 0, textAlign: 'left', minHeight: 32 }} onClick={() => { setBudgetStr(''); setEditBudget(true); }}>+ {t('Imposta un budget per il viaggio')}</button>
        )}
        <div className="row">
          <span className="col grow"><label htmlFor="simp" className="small strong">{t('Semplifica le spese')}</label>
            <span className="tiny" style={{ color: '#B5AC98' }}>{simplify ? tf('Calcolo automatico: {n} pagamenti per pareggiare', { n: nTransfers }) : tf('Disattivo: {n} rimborsi, uno per ogni debito', { n: nTransfers })}</span></span>
          <Switch id="simp" checked={simplify} onChange={setSimplify} />
        </div>
      </section>

      <div className="row">
        <label className="search grow"><Icon name="search" size={18} /><input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('Cerca spese, persone, importi')} aria-label={t('Cerca spese')} /></label>
        <Link to="statistiche" className="icon-btn" style={{ background: 'var(--card)', border: '1px solid var(--line)' }} aria-label={t('Statistiche')}><Icon name="chart" size={20} /></Link>
      </div>
      <div className="chips" role="group" aria-label={t('Filtra per categoria')}>
        <button className="chip teal" aria-pressed={onlyMine} onClick={() => setOnlyMine((v) => !v)}>{t('Solo le mie')}</button>
        <button className="chip" aria-pressed={cat === 'tutte'} onClick={() => setCat('tutte')}>{t('Tutti')}</button>
        {EXPENSE_CATEGORIES.map((c) => <button key={c.id} className="chip" aria-pressed={cat === c.id} onClick={() => setCat(c.id)}>{t(c.label)}</button>)}
      </div>

      {byDay.map(([day, items]) => (
        <section key={day} className="stack" style={{ gap: 8 }}>
          <h2 className="small strong muted">{dateLong(day)}</h2>
          <ul className="rowlist">
            {items.map((e) => {
              const c = EXPENSE_CATEGORIES.find((x) => x.id === e.category)!;
              const mine = b.shares.find((s) => s.expense_id === e.id && s.member_id === me?.id)?.amount_base ?? 0;
              return (
                <li key={e.id}>
                  <button className="linkcard" onClick={() => nav(`nuova?id=${e.id}`)}>
                    <span className="icon-tile" style={{ width: 40, height: 40, borderRadius: 12, background: c.bg, color: c.fg, fontWeight: 700 }}>{e.title.charAt(0).toUpperCase()}</span>
                    <span className="col grow" style={{ gap: 2 }}>
                      <span className="row strong" style={{ gap: 6 }}><span className="ellipsis">{e.title}</span>{e.receipt_path && <Icon name="receipt" size={14} label={t("Scontrino allegato")} className="muted" />}</span>
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
      {(q || onlyMine || cat !== 'tutte') && !!list.length && <p className="tiny muted" style={{ textAlign: 'center' }}>{list.length} {t('spese')} · {money(listTotal, cur)}</p>}
      {!list.length && (b.expenses.length
        ? <p className="empty">{t('Nessuna spesa corrisponde alla ricerca.')}</p>
        : <p className="empty">{t('Nessuna spesa ancora.')} {t('Fotografa uno scontrino per iniziare.')}</p>)}

      {editBudget && (
        <Sheet title={t('Budget del viaggio')} onClose={() => setEditBudget(false)}>
          <form className="stack" onSubmit={saveBudget}>
            <p className="small muted">{t('Il totale delle spese del gruppo viene confrontato con questo importo.')}</p>
            <div className="field"><label htmlFor="bdg">{t('Budget')} ({cur})</label>
              <input id="bdg" className="input" inputMode="decimal" value={budgetStr} onChange={(e) => setBudgetStr(e.target.value)} placeholder="2000" autoFocus /></div>
            <button className="btn btn-teal btn-block">{t('Salva')}</button>
            {budget && <button type="button" className="btn btn-ghost btn-block" onClick={async () => { const { error } = await supabase.from('trips').update({ budget: null }).eq('id', b.trip.id); if (error) toast(errorText(error)); else { setEditBudget(false); refresh(); } }}>{t('Rimuovi il budget')}</button>}
          </form>
        </Sheet>
      )}

      <Link to="nuova?scan=1" className="fab orange"><Icon name="camera" size={20} />{t('Scansiona scontrino')}</Link>
      <Link to="nuova" className="fab teal" style={{ bottom: 'calc(var(--tabbar) + 88px)', width: 56, padding: 0, justifyContent: 'center' }} aria-label={t('Nuova spesa')}><Icon name="plus" size={22} /></Link>
      <TabBar />
    </div>
  );
}
