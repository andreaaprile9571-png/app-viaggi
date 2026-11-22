import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Icon, toast } from '../../components/ui';
import { fileUrl, saveExpense } from '../../lib/api';
import { splitEqual, splitWeights } from '../../lib/balances';
import { CURRENCIES, EXPENSE_CATEGORIES, money, uid, errorText } from '../../lib/format';
import { t } from '../../lib/i18n';
import { fxRate } from '../../lib/integrations';
import { readReceipt, shrinkImage } from '../../lib/ocr';
import { useTrip } from '../../lib/TripContext';
import { supabase, type ExpenseCategory } from '../../lib/supabase';

type Mode = 'equal' | 'amounts' | 'shares';
const parseAmount = (s: string) => Number(s.replace(/\s/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.')) || 0;
const fmtInput = (n: number) => n.toFixed(2).replace('.', ',');

export default function ExpenseForm() {
  const { b, refresh } = useTrip();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const editing = b.expenses.find((e) => e.id === params.get('id'));
  const tripCur = b.trip.currency;
  const fileRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState(editing?.title ?? '');
  const [amountStr, setAmountStr] = useState(editing ? fmtInput(editing.amount) : '');
  const [currency, setCurrency] = useState(editing?.currency ?? tripCur);
  const [rate, setRate] = useState(editing?.rate ?? 1);
  const [paidBy, setPaidBy] = useState(editing?.paid_by ?? b.me?.id ?? b.members[0]?.id);
  const [category, setCategory] = useState<ExpenseCategory>(editing?.category ?? 'cibo');
  const [day, setDay] = useState(editing?.spent_on ?? new Date().toISOString().slice(0, 10));
  const [mode, setMode] = useState<Mode>(editing?.split_mode ?? 'equal');
  const existing = editing ? b.shares.filter((s) => s.expense_id === editing.id) : [];
  const [included, setIncluded] = useState<string[]>(existing.length ? existing.map((s) => s.member_id) : b.members.map((m) => m.id));
  const [custom, setCustom] = useState<Record<string, string>>(Object.fromEntries(existing.map((s) => [s.member_id, editing?.split_mode === 'shares' ? String(s.weight ?? 1) : fmtInput(s.amount_base)])));
  const [receipt, setReceipt] = useState<Blob | null>(null);
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const [ocr, setOcr] = useState<{ progress: number; done: boolean; merchant?: string | null } | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const amount = parseAmount(amountStr);
  const amountBase = Math.round(amount * rate * 100) / 100;

  useEffect(() => { if (params.get('scan') === '1' && !editing) setTimeout(() => fileRef.current?.click(), 200); }, [params, editing]);
  useEffect(() => { if (editing?.receipt_path) fileUrl(editing.receipt_path).then(setReceiptPreview).catch(() => {}); }, [editing?.receipt_path]);
  useEffect(() => {
    if (currency === tripCur) { setRate(1); return; }
    if (editing && editing.currency === currency) return;
    fxRate(currency, tripCur, day).then(setRate).catch(() => setErr('Tasso di cambio non disponibile offline: inserisci la spesa nella valuta del viaggio.'));
  }, [currency, tripCur, day, editing]);

  const shares = useMemo(() => {
    if (!amountBase || !included.length) return {} as Record<string, number>;
    if (mode === 'equal') return splitEqual(amountBase, included);
    if (mode === 'shares') return splitWeights(amountBase, Object.fromEntries(included.map((id) => [id, parseAmount(custom[id] ?? '1') || 0])));
    return Object.fromEntries(included.map((id) => [id, Math.round(parseAmount(custom[id] ?? '0') * rate * 100) / 100]));
  }, [amountBase, included, mode, custom, rate]);
  const sharesSum = Object.values(shares).reduce((a, v) => a + v, 0);
  const sumOk = Math.abs(sharesSum - amountBase) < 0.011;

  async function onPhoto(f: File | undefined) {
    if (!f) return;
    const small = await shrinkImage(f);
    setReceipt(small);
    setReceiptPreview(URL.createObjectURL(small));
    setOcr({ progress: 0, done: false });
    try {
      const g = await readReceipt(small, (p) => setOcr((o) => ({ ...(o ?? { done: false }), progress: p })));
      if (g.total && !amountStr) setAmountStr(fmtInput(g.total));
      if (g.date) setDay(g.date);
      if (g.merchant && !title) setTitle(g.merchant);
      setOcr({ progress: 1, done: true, merchant: g.merchant });
    } catch {
      setOcr(null);
      toast('Non sono riuscito a leggere lo scontrino: inserisci i dati a mano');
    }
  }

  async function save() {
    if (!b.me || !paidBy) return;
    setBusy(true); setErr(null);
    try {
      const res = await saveExpense({
        id: editing?.id, trip_id: b.trip.id, title: title.trim() || 'Spesa', amount, currency, rate, amount_base: amountBase,
        paid_by: paidBy, category, spent_on: day, split_mode: mode, receipt_path: editing?.receipt_path ?? null,
        client_id: editing?.client_id ?? uid(),
      }, included.map((id) => ({ member_id: id, amount_base: shares[id] ?? 0, weight: mode === 'shares' ? parseAmount(custom[id] ?? '1') : null })), receipt);
      toast(res.queued ? 'Spesa salvata sul telefono: la invio appena torni online' : 'Spesa salvata');
      await refresh();
      nav('..', { relative: 'path' });
    } catch (e) { setErr(errorText(e)); }
    finally { setBusy(false); }
  }

  async function remove() {
    if (!editing || !confirm('Eliminare questa spesa?')) return;
    await supabase.from('expenses').delete().eq('id', editing.id);
    await refresh();
    nav('..', { relative: 'path' });
  }

  const name = (id: string) => (id === b.me?.id ? 'Io' : b.members.find((m) => m.id === id)?.display_name ?? '');

  return (
    <div className="screen no-tabs">
      <header className="between">
        <Link to=".." relative="path" className="icon-btn" aria-label={t('Chiudi')}><Icon name="close" size={20} /></Link>
        <h1 style={{ fontSize: 17, fontWeight: 600 }}>{editing ? 'Modifica spesa' : t('Nuova spesa')}</h1>
        {editing ? <button className="icon-btn" onClick={remove} aria-label={t('Elimina')}><Icon name="trash" size={20} /></button> : <span style={{ width: 44 }} />}
      </header>

      <section className="row" style={{ padding: 12, background: 'var(--bg)', borderRadius: 18, alignItems: 'flex-start' }}>
        {receiptPreview ? <img src={receiptPreview} alt="Scontrino" className="receipt-thumb" />
          : <span className="receipt-thumb" style={{ background: 'var(--card)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)' }}><Icon name="receipt" size={30} /></span>}
        <div className="col grow" style={{ gap: 8 }}>
          {ocr && !ocr.done && <><span className="small">{t('Sto leggendo lo scontrino…')}</span><div className="progress"><div style={{ width: `${Math.round(ocr.progress * 100)}%` }} /></div></>}
          {ocr?.done && <span className="pill teal" style={{ alignSelf: 'flex-start' }}><Icon name="check" size={13} />{t('Letto dallo scontrino')}: controlla i dati</span>}
          {!ocr && <span className="small muted">Fotografa lo scontrino: leggo totale e data sul telefono, senza inviarlo a nessuno.</span>}
          <label className="btn btn-ghost" style={{ position: 'relative', minHeight: 40, alignSelf: 'flex-start' }}>
            <Icon name="camera" size={18} />{receipt || receiptPreview ? 'Rifai foto' : t('Scansiona scontrino')}
            <input ref={fileRef} type="file" accept="image/*" capture="environment" style={{ position: 'absolute', opacity: 0, inset: 0 }} onChange={(e) => onPhoto(e.target.files?.[0])} />
          </label>
        </div>
      </section>

      <div className="field"><label htmlFor="e-amount">{t('Importo')}</label>
        <div className="amount-input">
          <input id="e-amount" inputMode="decimal" value={amountStr} onChange={(e) => setAmountStr(e.target.value)} placeholder="0,00" />
          <select aria-label={t('Valuta')} className="input" style={{ width: 96, minHeight: 40 }} value={currency} onChange={(e) => setCurrency(e.target.value)}>{CURRENCIES.map((c) => <option key={c}>{c}</option>)}</select>
        </div>
        {currency !== tripCur && amount > 0 && <span className="tiny muted">= {money(amountBase, tripCur)} · tasso BCE {rate.toFixed(4)}</span>}
      </div>
      <div className="field"><label htmlFor="e-title">Descrizione</label>
        <input id="e-title" className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="es. Cena ad Alfama" maxLength={160} /></div>
      <div className="pair">
        <div className="field"><label htmlFor="e-day">Data</label><input id="e-day" className="input" type="date" value={day} onChange={(e) => setDay(e.target.value)} /></div>
        <div className="field"><label htmlFor="e-cat">{t('Categoria')}</label>
          <select id="e-cat" className="input" value={category} onChange={(e) => setCategory(e.target.value as ExpenseCategory)}>
            {EXPENSE_CATEGORIES.map((c) => <option key={c.id} value={c.id}>{t(c.label)}</option>)}</select></div>
      </div>

      <div className="field"><span className="label">{t('Pagato da')}</span>
        <div className="chips" role="group" aria-label={t('Pagato da')}>
          {b.members.map((m) => <button key={m.id} type="button" className="chip teal" aria-pressed={paidBy === m.id} onClick={() => setPaidBy(m.id)}>{name(m.id)}</button>)}
        </div></div>

      <div className="stack">
        <div className="between"><span className="label">{t('Dividi tra')}</span>
          <div className="segmented" role="group" aria-label="Modo di divisione" style={{ padding: 3 }}>
            {([['equal', 'Uguale'], ['amounts', 'Importi'], ['shares', 'Quote']] as [Mode, string][]).map(([id, l]) => (
              <button key={id} type="button" aria-pressed={mode === id} onClick={() => setMode(id)} style={{ minHeight: 34, padding: '0 12px' }}>{t(l)}</button>
            ))}
          </div></div>
        <ul className="list" style={{ border: '1px solid var(--line)' }}>
          {b.members.map((m) => {
            const on = included.includes(m.id);
            return (
              <li key={m.id} style={{ padding: '4px 0' }}>
                <input type="checkbox" id={`p-${m.id}`} checked={on} onChange={() => setIncluded((x) => (on ? x.filter((i) => i !== m.id) : [...x, m.id]))} style={{ width: 22, height: 22, margin: 0, accentColor: 'var(--teal)' }} />
                <label htmlFor={`p-${m.id}`} className="grow" style={{ minHeight: 44, display: 'flex', alignItems: 'center' }}>{m.id === b.me?.id ? `${m.display_name} (tu)` : m.display_name}</label>
                {on && mode !== 'equal' && (
                  <input aria-label={`${mode === 'shares' ? 'Quote' : 'Importo'} di ${m.display_name}`} className="input" inputMode="decimal" style={{ width: 84, minHeight: 40, textAlign: 'right' }}
                    value={custom[m.id] ?? (mode === 'shares' ? '1' : '')} onChange={(e) => setCustom((c) => ({ ...c, [m.id]: e.target.value }))} />
                )}
                <span className={on ? 'strong' : 'small muted'} style={{ minWidth: 74, textAlign: 'right' }}>{on ? money(shares[m.id] ?? 0, tripCur) : 'esclusa/o'}</span>
              </li>
            );
          })}
        </ul>
        {mode === 'amounts' && amount > 0 && !sumOk && <p className="tiny" style={{ color: 'var(--orange-dark)' }}>Le quote sommano {money(sharesSum, tripCur)} su {money(amountBase, tripCur)}.</p>}
      </div>
      {err && <p className="error">{err}</p>}

      <div className="bottom-bar">
        <button className="btn btn-primary btn-block" onClick={save} disabled={busy || !amount || !included.length || !sumOk}>{busy ? 'Salvataggio…' : t('Salva spesa')}</button>
      </div>
    </div>
  );
}
