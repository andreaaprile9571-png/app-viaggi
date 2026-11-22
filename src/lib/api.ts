// Accesso ai dati: carica il viaggio da Supabase, lo salva sul telefono per l'uso offline,
// e mette in coda le spese create senza rete.
import { del, get, keys, set } from 'idb-keyval';
import { BUCKET, supabase } from './supabase';
import type { Expense, ListItem, Member, Profile, Trip, TripBundle } from './supabase';

const bundleKey = (id: string) => `trip:${id}`;
const QUEUE = 'queue:expenses';

export async function currentUserId() {
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id ?? null;
}

export async function loadTrips(): Promise<{ trips: Trip[]; members: Member[] }> {
  try {
    const uid = await currentUserId();
    const { data: trips, error } = await supabase.from('trips').select('*').order('start_date', { ascending: true, nullsFirst: false });
    if (error) throw error;
    const { data: members } = await supabase.from('members').select('*');
    const out = { trips: trips ?? [], members: members ?? [] };
    await set(`trips:${uid}`, out);
    return out;
  } catch (e) {
    const uid = await currentUserId();
    const cached = await get(`trips:${uid}`);
    if (cached) return cached;
    throw e;
  }
}

export async function loadTripBundle(tripId: string): Promise<TripBundle> {
  try {
    const uid = await currentUserId();
    const [trip, members, documents, expenses, settlements, activity, lists] = await Promise.all([
      supabase.from('trips').select('*').eq('id', tripId).single(),
      supabase.from('members').select('*').eq('trip_id', tripId).order('created_at'),
      supabase.from('documents').select('*').eq('trip_id', tripId).order('starts_at', { ascending: true, nullsFirst: false }),
      supabase.from('expenses').select('*').eq('trip_id', tripId).order('spent_on', { ascending: false }).order('created_at', { ascending: false }),
      supabase.from('settlements').select('*').eq('trip_id', tripId).order('created_at'),
      supabase.from('activity').select('*').eq('trip_id', tripId).order('created_at', { ascending: false }).limit(30),
      supabase.from('list_items').select('*').eq('trip_id', tripId).order('created_at'),
    ]);
    if (trip.error) throw trip.error;
    const docIds = (documents.data ?? []).map((d) => d.id);
    const expIds = (expenses.data ?? []).map((e) => e.id);
    const [assignees, shares] = await Promise.all([
      docIds.length ? supabase.from('document_assignees').select('*').in('document_id', docIds) : Promise.resolve({ data: [] }),
      expIds.length ? supabase.from('expense_shares').select('*').in('expense_id', expIds) : Promise.resolve({ data: [] }),
    ]);
    const userIds = (members.data ?? []).map((m) => m.user_id).filter(Boolean) as string[];
    const profiles = userIds.length ? (await supabase.from('profiles').select('id,display_name,paypal_me,iban,locale').in('id', userIds)).data ?? [] : [];
    const ms = (members.data ?? []) as Member[];
    const bundle: TripBundle = {
      trip: trip.data as Trip, members: ms, documents: documents.data ?? [], assignees: assignees.data ?? [],
      expenses: (expenses.data ?? []).map(numExpense), shares: (shares.data ?? []).map((s) => ({ ...s, amount_base: Number(s.amount_base) })),
      settlements: (settlements.data ?? []).map((s) => ({ ...s, amount_base: Number(s.amount_base) })),
      activity: activity.data ?? [], profiles: profiles as Profile[], lists: (lists.data ?? []) as ListItem[],
      me: ms.find((m) => m.user_id === uid) ?? null, fetchedAt: Date.now(),
    };
    await set(bundleKey(tripId), bundle);
    return bundle;
  } catch (e) {
    const cached = await get<TripBundle>(bundleKey(tripId));
    if (cached) return { ...cached, lists: cached.lists ?? [], fetchedAt: -cached.fetchedAt };
    throw e;
  }
}

const numExpense = (e: Expense): Expense => ({ ...e, amount: Number(e.amount), rate: Number(e.rate), amount_base: Number(e.amount_base) });

export async function cachedBundle(tripId: string) {
  return get<TripBundle>(bundleKey(tripId));
}

// ---------- spese con coda offline ----------
export type ExpenseDraft = {
  id?: string; trip_id: string; title: string; amount: number; currency: string; rate: number; amount_base: number;
  paid_by: string; category: string; spent_on: string; split_mode: string; receipt_path?: string | null; client_id: string;
};
export type ShareDraft = { member_id: string; amount_base: number; weight?: number | null };
type Queued = { expense: ExpenseDraft; shares: ShareDraft[]; receipt?: Blob | null; receiptExt?: string };

export async function saveExpense(expense: ExpenseDraft, shares: ShareDraft[], receipt?: Blob | null, receiptExt = 'jpg') {
  if (!navigator.onLine) { await enqueue({ expense, shares, receipt, receiptExt }); return { queued: true }; }
  try {
    await pushExpense({ expense, shares, receipt, receiptExt });
    return { queued: false };
  } catch (e) {
    if (!navigator.onLine || String(e).includes('Failed to fetch')) { await enqueue({ expense, shares, receipt, receiptExt }); return { queued: true }; }
    throw e;
  }
}

async function pushExpense(q: Queued) {
  let receipt_path = q.expense.receipt_path ?? null;
  if (q.receipt) {
    receipt_path = `${q.expense.trip_id}/receipts/${q.expense.client_id}.${q.receiptExt ?? 'jpg'}`;
    const up = await supabase.storage.from(BUCKET).upload(receipt_path, q.receipt, { upsert: true, contentType: q.receipt.type || 'image/jpeg' });
    if (up.error) throw up.error;
  }
  const { error } = await supabase.rpc('save_expense', { p_expense: { ...q.expense, receipt_path }, p_shares: q.shares });
  if (error) throw error;
}

async function enqueue(q: Queued) {
  const list = (await get<Queued[]>(QUEUE)) ?? [];
  list.push(q);
  await set(QUEUE, list);
}

export async function queuedExpenses(tripId?: string) {
  const list = (await get<Queued[]>(QUEUE)) ?? [];
  return tripId ? list.filter((q) => q.expense.trip_id === tripId) : list;
}

export async function flushQueue() {
  const list = (await get<Queued[]>(QUEUE)) ?? [];
  if (!list.length || !navigator.onLine) return 0;
  const left: Queued[] = [];
  let sent = 0;
  for (const q of list) {
    try { await pushExpense(q); sent++; } catch { left.push(q); }
  }
  await set(QUEUE, left);
  return sent;
}

// ---------- file ----------
/** Il file del documento: dalla copia sul telefono se c'è, altrimenti scaricato (e salvato offline). */
export async function fileBlob(path: string): Promise<Blob> {
  const cacheKey = `file:${path}`;
  const cached = await get<Blob>(cacheKey);
  if (cached) return cached;
  const { data, error } = await supabase.storage.from(BUCKET).download(path);
  if (error || !data) throw error ?? new Error('download');
  await set(cacheKey, data);
  return data;
}

export async function fileUrl(path: string) {
  return URL.createObjectURL(await fileBlob(path));
}

export async function isFileCached(path: string) {
  return !!(await get(`file:${path}`));
}

/** Scarica sul telefono i documenti dei prossimi 7 giorni (o tutti quelli assegnati a me). */
export async function prefetchDocuments(bundle: TripBundle) {
  const soon = Date.now() + 7 * 86400000;
  const mine = new Set(bundle.assignees.filter((a) => a.member_id === bundle.me?.id).map((a) => a.document_id));
  const targets = bundle.documents.filter((d) => d.file_path && (mine.has(d.id) || (d.starts_at && new Date(d.starts_at).getTime() < soon)));
  let n = 0;
  for (const d of targets) {
    if (!(await isFileCached(d.file_path!))) {
      try { const { data } = await supabase.storage.from(BUCKET).download(d.file_path!); if (data) { await set(`file:${d.file_path}`, data); n++; } } catch { /* offline */ }
    }
  }
  return n;
}

export async function clearLocalData() {
  for (const k of await keys()) await del(k);
}
