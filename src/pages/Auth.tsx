import { Logo } from '../components/ui';
import { errorText } from '../lib/format';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { t } from '../lib/i18n';
import { supabase } from '../lib/supabase';

const MIN_AGE = 14;

export default function Auth() {
  const [mode, setMode] = useState<'login' | 'signup'>('signup');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [age, setAge] = useState(false);
  const [terms, setTerms] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null); setMsg(null); setBusy(true);
    try {
      if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({
          email, password,
          options: { data: { display_name: name.trim(), accepted_terms: true }, emailRedirectTo: window.location.origin + import.meta.env.BASE_URL },
        });
        if (error) throw error;
        if (!data.session) setMsg('Ti abbiamo inviato un\'email di conferma. Aprila e poi accedi.');
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (e) {
      const m = errorText(e);
      setErr(/invalid login/i.test(m) ? 'Email o password non corretti.' : /already registered/i.test(m) ? 'Questa email ha già un account: accedi.' : m);
    } finally { setBusy(false); }
  }

  async function forgot() {
    if (!email) { setErr('Scrivi prima la tua email.'); return; }
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + import.meta.env.BASE_URL + 'impostazioni' });
    setMsg(error ? error.message : 'Ti abbiamo inviato un link per reimpostare la password.');
  }

  const canSubmit = email && password.length >= 8 && (mode === 'login' || (name.trim() && age && terms));

  return (
    <div className="screen no-tabs" style={{ justifyContent: 'center' }}>
      <div className="col" style={{ gap: 6 }}>
        <span style={{ marginBottom: 10 }}><Logo size={34} withName /></span>
        <h1 className="display" style={{ fontSize: 34 }}>Documenti e spese del viaggio, in un posto solo.</h1>
        <p className="muted">Biglietti per ognuno, anche offline. Uno scontrino diventa una spesa già divisa.</p>
      </div>
      <div className="segmented" role="group" aria-label="Accesso">
        <button type="button" aria-pressed={mode === 'signup'} onClick={() => setMode('signup')}>{t('Registrati')}</button>
        <button type="button" aria-pressed={mode === 'login'} onClick={() => setMode('login')}>{t('Accedi')}</button>
      </div>
      <form className="stack" onSubmit={submit}>
        {mode === 'signup' && (
          <div className="field"><label htmlFor="name">{t('Il tuo nome')}</label>
            <input id="name" className="input" value={name} onChange={(e) => setName(e.target.value)} autoComplete="given-name" maxLength={60} required /></div>
        )}
        <div className="field"><label htmlFor="email">{t('Email')}</label>
          <input id="email" className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required /></div>
        <div className="field"><label htmlFor="pw">{t('Password')} {mode === 'signup' && <span className="tiny">(almeno 8 caratteri)</span>}</label>
          <input id="pw" className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} minLength={8} required /></div>
        {mode === 'signup' && (
          <>
            <label className="row small"><input type="checkbox" checked={age} onChange={(e) => setAge(e.target.checked)} style={{ width: 22, height: 22, accentColor: 'var(--teal)' }} />
              Ho almeno {MIN_AGE} anni</label>
            <label className="row small"><input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} style={{ width: 22, height: 22, accentColor: 'var(--teal)' }} />
              <span>Accetto i <Link to="/termini">Termini di utilizzo</Link> e ho letto l'<Link to="/privacy">Informativa privacy</Link></span></label>
          </>
        )}
        {err && <p className="error" role="alert">{err}</p>}
        {msg && <p className="banner teal" role="status">{msg}</p>}
        <button className="btn btn-primary btn-block" disabled={!canSubmit || busy}>{busy ? '…' : mode === 'signup' ? 'Crea account' : t('Accedi')}</button>
        {mode === 'login' && <button type="button" className="btn btn-ghost btn-block" onClick={forgot}>Password dimenticata</button>}
      </form>
    </div>
  );
}
