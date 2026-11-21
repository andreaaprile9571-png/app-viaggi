import { useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import type { Session } from '@supabase/supabase-js';
import { ToastHost } from './components/ui';
import { flushQueue } from './lib/api';
import { useLang } from './lib/i18n';
import { supabase } from './lib/supabase';
import { TripProvider } from './lib/TripContext';
import Auth from './pages/Auth';
import Join from './pages/Join';
import { DeleteAccountInfo, Privacy, Terms } from './pages/Legal';
import Settings from './pages/Settings';
import Trips from './pages/Trips';
import Balances from './pages/trip/Balances';
import DocumentDetail from './pages/trip/DocumentDetail';
import Documents from './pages/trip/Documents';
import ExpenseForm from './pages/trip/ExpenseForm';
import Expenses from './pages/trip/Expenses';
import Group from './pages/trip/Group';
import Overview from './pages/trip/Overview';

export default function App() {
  useLang();
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [name, setName] = useState('');

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    const online = () => flushQueue();
    window.addEventListener('online', online);
    return () => { data.subscription.unsubscribe(); window.removeEventListener('online', online); };
  }, []);

  useEffect(() => {
    if (!session) return;
    const fallback = (session.user.user_metadata?.display_name as string) || session.user.email?.split('@')[0] || '';
    setName(fallback);
    supabase.from('profiles').select('display_name').eq('id', session.user.id).single()
      .then(({ data }) => { if (data?.display_name) setName(data.display_name); });
  }, [session]);

  if (session === undefined) return null;

  return (
    <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '') || '/'}>
      <ToastHost />
      <Routes>
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/termini" element={<Terms />} />
        <Route path="/elimina-account" element={<DeleteAccountInfo />} />
        {!session ? (
          <Route path="*" element={<Auth />} />
        ) : (
          <>
            <Route path="/" element={<Trips name={name} />} />
            <Route path="/j/:code" element={<Join name={name} />} />
            <Route path="/impostazioni" element={<Settings userId={session.user.id} email={session.user.email ?? ''} />} />
            <Route path="/viaggio/:tripId" element={<TripProvider />}>
              <Route index element={<Overview />} />
              <Route path="documenti" element={<Documents />} />
              <Route path="documenti/:docId" element={<DocumentDetail />} />
              <Route path="spese" element={<Expenses />} />
              <Route path="spese/nuova" element={<ExpenseForm />} />
              <Route path="spese/saldi" element={<Balances />} />
              <Route path="gruppo" element={<Group />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </>
        )}
      </Routes>
    </BrowserRouter>
  );
}
