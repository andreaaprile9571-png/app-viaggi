import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon, toast } from '../components/ui';
import AvatarPicker, { deleteAvatarFiles } from '../components/AvatarPicker';
import { clearLocalData } from '../lib/api';
import { getLang, setLang, t, useLang } from '../lib/i18n';
import { exportJson } from '../lib/importexport';
import { supabase, type Profile } from '../lib/supabase';

export default function Settings({ userId, email }: { userId: string; email: string }) {
  useLang();
  const [p, setP] = useState<Profile | null>(null);
  const [newPw, setNewPw] = useState('');

  useEffect(() => { supabase.from('profiles').select('*').eq('id', userId).single().then(({ data }) => setP(data as Profile)); }, [userId]);

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!p) return;
    const { error } = await supabase.from('profiles').update({ display_name: p.display_name, paypal_me: p.paypal_me || null, iban: p.iban?.replace(/\s/g, '').toUpperCase() || null }).eq('id', userId);
    toast(error ? error.message : t('Profilo salvato'));
  }
  async function changePw() {
    const { error } = await supabase.auth.updateUser({ password: newPw });
    toast(error ? error.message : t('Password aggiornata')); setNewPw('');
  }
  async function exportAll() {
    const tables = ['profiles', 'trips', 'members', 'documents', 'document_assignees', 'expenses', 'expense_shares', 'settlements', 'activity'];
    const out: Record<string, unknown> = { exported_at: new Date().toISOString(), email };
    for (const tb of tables) out[tb] = (await supabase.from(tb).select('*')).data;
    exportJson(out, 'i-miei-dati.json');
  }
  async function deleteAccount() {
    if (!confirm(t("Eliminare definitivamente il tuo account? I documenti che hai caricato verranno cancellati; nelle spese condivise comparirai come \"Utente eliminato\"."))) return;
    if (prompt(t("Per confermare scrivi ELIMINA")) !== 'ELIMINA') return;
    await deleteAvatarFiles(userId);
    const { error } = await supabase.rpc('delete_my_account');
    if (error) { toast(error.message); return; }
    await clearLocalData();
    await supabase.auth.signOut();
  }
  async function signOut() { await clearLocalData(); await supabase.auth.signOut(); }

  return (
    <div className="screen no-tabs">
      <header className="row"><Link to="/" className="icon-btn" aria-label={t("Indietro")}><Icon name="back" /></Link><h1 className="display" style={{ fontSize: 28 }}>{t('Impostazioni')}</h1></header>

      <form className="card stack" onSubmit={saveProfile}>
        <h2 className="eyebrow">{t('Profilo e pagamenti')}</h2>
        <p className="small muted">{email}</p>
        <AvatarPicker userId={userId} name={p?.display_name ?? ''} url={p?.avatar_url} onChange={(u) => p && setP({ ...p, avatar_url: u })} />
        <div className="field"><label htmlFor="s-name">{t('Il tuo nome')}</label>
          <input id="s-name" className="input" value={p?.display_name ?? ''} onChange={(e) => p && setP({ ...p, display_name: e.target.value })} /></div>
        <div className="field"><label htmlFor="s-pp">{t('Link PayPal.me')} <span className="tiny">{t("(facoltativo)")}</span></label>
          <input id="s-pp" className="input" value={p?.paypal_me ?? ''} onChange={(e) => p && setP({ ...p, paypal_me: e.target.value })} placeholder={t("paypal.me/nome")} /></div>
        <div className="field"><label htmlFor="s-iban">{t('IBAN')} <span className="tiny">{t("(facoltativo, visibile ai compagni di viaggio)")}</span></label>
          <input id="s-iban" className="input" value={p?.iban ?? ''} onChange={(e) => p && setP({ ...p, iban: e.target.value })} /></div>
        <button className="btn btn-primary">{t('Salva')}</button>
      </form>

      <section className="card stack">
        <h2 className="eyebrow">{t('Lingua')}</h2>
        <div className="segmented" role="group" aria-label={t('Lingua')}>
          <button aria-pressed={getLang() === 'it'} onClick={() => setLang('it')}>{t("Italiano")}</button>
          <button aria-pressed={getLang() === 'en'} onClick={() => setLang('en')}>{t("English")}</button>
        </div>
      </section>

      <section className="card stack">
        <h2 className="eyebrow">{t("Sicurezza")}</h2>
        <div className="row"><input aria-label={t("Nuova password")} className="input" type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} placeholder={t("Nuova password (min. 8)")} minLength={8} />
          <button className="btn btn-ghost" disabled={newPw.length < 8} onClick={changePw}>{t("Cambia")}</button></div>
      </section>

      <section className="stack">
        <button className="btn btn-ghost btn-block" onClick={exportAll}><Icon name="download" size={18} />{t('Esporta i miei dati')}</button>
        <button className="btn btn-ghost btn-block" onClick={signOut}>{t('Esci')}</button>
        <button className="btn btn-danger btn-block" onClick={deleteAccount}><Icon name="trash" size={18} />{t('Elimina account')}</button>
      </section>
      <p className="small muted" style={{ textAlign: 'center' }}><Link to="/privacy">{t('Privacy')}</Link> · <Link to="/termini">{t('Termini di utilizzo')}</Link> · <Link to="/elimina-account">{t("Eliminazione account")}</Link></p>
    </div>
  );
}
