import type { Expense, Share, Settlement } from './supabase';

const round = (v: number) => Math.round(v * 100) / 100;

/** Saldo netto di ogni membro nella valuta del viaggio: positivo = deve ricevere. */
export function netBalances(memberIds: string[], expenses: Expense[], shares: Share[], settlements: Settlement[]) {
  const bal: Record<string, number> = Object.fromEntries(memberIds.map((id) => [id, 0]));
  for (const e of expenses) bal[e.paid_by] = (bal[e.paid_by] ?? 0) + Number(e.amount_base);
  for (const s of shares) bal[s.member_id] = (bal[s.member_id] ?? 0) - Number(s.amount_base);
  for (const s of settlements) {
    bal[s.from_member] = (bal[s.from_member] ?? 0) + Number(s.amount_base);
    bal[s.to_member] = (bal[s.to_member] ?? 0) - Number(s.amount_base);
  }
  for (const k of Object.keys(bal)) bal[k] = round(bal[k]);
  return bal;
}

export type Transfer = { from: string; to: string; amount: number };

/** "Semplifica le spese": il minor numero di pagamenti che azzera i saldi netti. */
export function simplifiedTransfers(balances: Record<string, number>): Transfer[] {
  const debtors = Object.entries(balances).filter(([, v]) => v < -0.005).map(([id, v]) => ({ id, v: -v }));
  const creditors = Object.entries(balances).filter(([, v]) => v > 0.005).map(([id, v]) => ({ id, v }));
  debtors.sort((a, b) => b.v - a.v);
  creditors.sort((a, b) => b.v - a.v);
  const out: Transfer[] = [];
  let i = 0, j = 0;
  while (i < debtors.length && j < creditors.length) {
    const pay = Math.min(debtors[i].v, creditors[j].v);
    if (pay > 0.005) out.push({ from: debtors[i].id, to: creditors[j].id, amount: round(pay) });
    debtors[i].v -= pay; creditors[j].v -= pay;
    if (debtors[i].v < 0.005) i++;
    if (creditors[j].v < 0.005) j++;
  }
  return out;
}

/** Senza semplificazione: un debito per ogni coppia di persone, calcolato spesa per spesa. */
export function pairwiseTransfers(expenses: Expense[], shares: Share[], settlements: Settlement[]): Transfer[] {
  const owe: Record<string, number> = {}; // chiave "da>a"
  const add = (from: string, to: string, v: number) => {
    if (from === to) return;
    const k = `${from}>${to}`, rk = `${to}>${from}`;
    if (owe[rk]) {
      const d = owe[rk] - v;
      if (d >= 0) owe[rk] = d; else { delete owe[rk]; owe[k] = (owe[k] ?? 0) - d; }
    } else owe[k] = (owe[k] ?? 0) + v;
  };
  const byExpense = new Map<string, Share[]>();
  for (const s of shares) byExpense.set(s.expense_id, [...(byExpense.get(s.expense_id) ?? []), s]);
  for (const e of expenses) for (const s of byExpense.get(e.id) ?? []) add(s.member_id, e.paid_by, Number(s.amount_base));
  for (const s of settlements) add(s.to_member, s.from_member, Number(s.amount_base));
  return Object.entries(owe)
    .map(([k, v]) => { const [from, to] = k.split('>'); return { from, to, amount: round(v) }; })
    .filter((t) => t.amount > 0.005)
    .sort((a, b) => b.amount - a.amount);
}

/** Divide un importo in parti uguali tra i partecipanti, assegnando i centesimi residui. */
export function splitEqual(total: number, ids: string[]): Record<string, number> {
  const cents = Math.round(total * 100);
  const base = Math.floor(cents / ids.length);
  let rest = cents - base * ids.length;
  const out: Record<string, number> = {};
  for (const id of ids) { out[id] = (base + (rest > 0 ? 1 : 0)) / 100; if (rest > 0) rest--; }
  return out;
}

/** Divide per quote (pesi), con arrotondamento al centesimo che somma esattamente al totale. */
export function splitWeights(total: number, weights: Record<string, number>): Record<string, number> {
  const ids = Object.keys(weights).filter((k) => weights[k] > 0);
  const sum = ids.reduce((a, k) => a + weights[k], 0);
  if (!sum) return {};
  const cents = Math.round(total * 100);
  const raw = ids.map((k) => ({ k, c: (cents * weights[k]) / sum }));
  const out: Record<string, number> = {};
  let used = 0;
  for (const r of raw) { out[r.k] = Math.floor(r.c); used += Math.floor(r.c); }
  raw.sort((a, b) => (b.c % 1) - (a.c % 1));
  for (let n = 0; n < cents - used; n++) out[raw[n % raw.length].k] += 1;
  for (const k of ids) out[k] = out[k] / 100;
  return out;
}
