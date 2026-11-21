// Import da Splitwise / Tricount (CSV) ed export CSV / Excel delle spese.
import Papa from 'papaparse';
import type { TripBundle } from './supabase';

export type ImportedExpense = {
  title: string; date: string; amount: number; currency: string; category: string;
  payer: string; shares: Record<string, number>;
};

const toNum = (v: unknown) => {
  if (typeof v === 'number') return v;
  const s = String(v ?? '').trim().replace(/\s/g, '');
  if (!s) return 0;
  if (/,\d{1,2}$/.test(s)) return Number(s.replace(/\./g, '').replace(',', '.'));
  return Number(s.replace(/,/g, ''));
};
const toDate = (v: string) => {
  const s = String(v ?? '').trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const m = s.match(/(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/);
  if (m) return `${m[3].length === 2 ? '20' + m[3] : m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return new Date().toISOString().slice(0, 10);
};

/**
 * Splitwise: colonne Date, Description, Category, Cost, Currency, poi una colonna per persona
 * con l'effetto netto della spesa (pagato − dovuto). Il pagatore ha il valore positivo.
 */
function parseSplitwise(rows: string[][]): ImportedExpense[] {
  const head = rows[0];
  const people = head.slice(5).filter(Boolean);
  const out: ImportedExpense[] = [];
  for (const r of rows.slice(1)) {
    if (!r[0] || /total balance|saldo totale/i.test(r[1] ?? '') || /payment|pagamento/i.test(r[2] ?? '')) continue;
    const cost = toNum(r[3]);
    if (!cost) continue;
    const nets = people.map((p, i) => ({ p, v: toNum(r[5 + i]) }));
    const payer = nets.reduce((a, b) => (b.v > a.v ? b : a), nets[0]);
    const shares: Record<string, number> = {};
    for (const n of nets) {
      const share = n.p === payer.p ? Math.round((cost - n.v) * 100) / 100 : Math.round(-n.v * 100) / 100;
      if (share > 0) shares[n.p] = share;
    }
    out.push({ title: r[1] || 'Spesa', date: toDate(r[0]), amount: cost, currency: r[4] || 'EUR', category: 'altro', payer: payer.p, shares });
  }
  return out;
}

/**
 * Tricount: una riga per spesa con "Paid by"/"Pagato da", importo e una colonna per persona
 * ("Impacted to X" / "Pagato per X" / nome) con la quota.
 */
function parseTricount(rows: string[][]): ImportedExpense[] {
  const head = rows[0].map((h) => h.trim());
  const idx = (re: RegExp) => head.findIndex((h) => re.test(h));
  const iTitle = idx(/^(title|titolo|description|descrizione|what)/i);
  const iAmount = idx(/^(amount|importo)(?! in)/i);
  const iCur = idx(/^(currency|valuta)/i);
  const iDate = idx(/^(date|data)/i);
  const iPaid = idx(/(paid by|pagato da|payer)/i);
  const shareCols = head.map((h, i) => ({ h, i })).filter(({ h }) => /(impacted to|pagato per|for |per )/i.test(h));
  const out: ImportedExpense[] = [];
  for (const r of rows.slice(1)) {
    const amount = Math.abs(toNum(r[iAmount]));
    if (!amount || !r[iPaid]) continue;
    const shares: Record<string, number> = {};
    for (const c of shareCols) {
      const v = Math.abs(toNum(r[c.i]));
      if (v) shares[c.h.replace(/^(impacted to|pagato per|for|per)\s*/i, '').trim()] = v;
    }
    out.push({ title: r[iTitle] || 'Spesa', date: toDate(r[iDate]), amount, currency: r[iCur] || 'EUR', category: 'altro', payer: r[iPaid].trim(), shares });
  }
  return out;
}

export function parseImport(text: string): { source: 'splitwise' | 'tricount' | 'unknown'; expenses: ImportedExpense[]; people: string[] } {
  const parsed = Papa.parse<string[]>(text.replace(/^﻿/, ''), { skipEmptyLines: true });
  const rows = parsed.data;
  if (!rows.length) return { source: 'unknown', expenses: [], people: [] };
  const head = rows[0].join(',').toLowerCase();
  let expenses: ImportedExpense[] = [];
  let source: 'splitwise' | 'tricount' | 'unknown' = 'unknown';
  if (/date,description,category,cost,currency/.test(head.replace(/\s/g, ''))) { source = 'splitwise'; expenses = parseSplitwise(rows); }
  else if (/paid by|pagato da/.test(head)) { source = 'tricount'; expenses = parseTricount(rows); }
  const people = [...new Set(expenses.flatMap((e) => [e.payer, ...Object.keys(e.shares)]))];
  return { source, expenses, people };
}

// ---------- export ----------
export function expenseRows(b: TripBundle) {
  const name = (id: string) => b.members.find((m) => m.id === id)?.display_name ?? '?';
  return b.expenses.map((e) => {
    const row: Record<string, string | number> = {
      Data: e.spent_on, Descrizione: e.title, Categoria: e.category, Importo: e.amount, Valuta: e.currency,
      [`Importo (${b.trip.currency})`]: e.amount_base, 'Pagato da': name(e.paid_by),
    };
    for (const m of b.members) row[m.display_name] = b.shares.find((s) => s.expense_id === e.id && s.member_id === m.id)?.amount_base ?? 0;
    return row;
  });
}

function download(blob: Blob, filename: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

const safe = (s: string) => s.replace(/[^\w-]+/g, '-').toLowerCase();

export function exportCsv(b: TripBundle) {
  const csv = Papa.unparse(expenseRows(b), { delimiter: ';' });
  download(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }), `spese-${safe(b.trip.name)}.csv`);
}

export async function exportXlsx(b: TripBundle, balances: { Persona: string; Saldo: number }[]) {
  const XLSX = await import('xlsx');
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(expenseRows(b)), 'Spese');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(balances), 'Saldi');
  const out = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
  download(new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `spese-${safe(b.trip.name)}.xlsx`);
}

export function exportJson(data: unknown, filename: string) {
  download(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }), filename);
}
