import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { errorText } from './format';
import { Outlet, useParams } from 'react-router-dom';
import { flushQueue, loadTripBundle, prefetchDocuments, queuedExpenses } from './api';
import { netBalances } from './balances';
import { supabase, type TripBundle } from './supabase';

type Ctx = {
  b: TripBundle; refresh: () => Promise<void>; stale: boolean; queued: number;
  balances: Record<string, number>; memberName: (id: string | null | undefined) => string;
};
const TripCtx = createContext<Ctx | null>(null);

export function useTrip() {
  const c = useContext(TripCtx);
  if (!c) throw new Error('useTrip outside provider');
  return c;
}

export function TripProvider({ children }: { children?: ReactNode }) {
  const { tripId } = useParams();
  const [b, setB] = useState<TripBundle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [queued, setQueued] = useState(0);

  const refresh = useCallback(async () => {
    if (!tripId) return;
    try {
      if (navigator.onLine) await flushQueue();
      const bundle = await loadTripBundle(tripId);
      setB(bundle);
      setQueued((await queuedExpenses(tripId)).length);
      if (bundle.fetchedAt > 0) prefetchDocuments(bundle);
    } catch (e) {
      setError(errorText(e));
    }
  }, [tripId]);

  useEffect(() => { refresh(); }, [refresh]);

  // Aggiornamenti in tempo reale dagli altri membri del gruppo
  useEffect(() => {
    if (!tripId) return;
    let timer: ReturnType<typeof setTimeout>;
    const later = () => { clearTimeout(timer); timer = setTimeout(refresh, 400); };
    const ch = supabase.channel(`trip-${tripId}`);
    for (const table of ['expenses', 'documents', 'members', 'settlements', 'activity', 'list_items']) {
      ch.on('postgres_changes', { event: '*', schema: 'public', table, filter: `trip_id=eq.${tripId}` }, later);
    }
    ch.on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'trips', filter: `id=eq.${tripId}` }, later);
    ch.subscribe();
    const online = () => refresh();
    window.addEventListener('online', online);
    return () => { supabase.removeChannel(ch); window.removeEventListener('online', online); clearTimeout(timer); };
  }, [tripId, refresh]);

  const value = useMemo<Ctx | null>(() => {
    if (!b) return null;
    const balances = netBalances(b.members.map((m) => m.id), b.expenses, b.shares, b.settlements);
    const memberName = (id: string | null | undefined) => b.members.find((m) => m.id === id)?.display_name ?? '—';
    return { b, refresh, stale: b.fetchedAt < 0, queued, balances, memberName };
  }, [b, refresh, queued]);

  if (error && !b) return <div className="screen"><p className="error">Impossibile caricare il viaggio: {error}</p></div>;
  if (!value) return <div className="screen"><p className="muted">Caricamento…</p></div>;
  return <TripCtx.Provider value={value}>{children ?? <Outlet />}</TripCtx.Provider>;
}
