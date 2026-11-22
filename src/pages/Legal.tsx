import { Link } from 'react-router-dom';
import { Icon } from '../components/ui';
import { getLang, t, useLang } from '../lib/i18n';

// Versione breve per la beta. Il testo completo, in revisione legale, va pubblicato a questi indirizzi prima del lancio.
const CONTACT = (import.meta.env.VITE_CONTACT_EMAIL as string) || 'privacy@[dominio]';

export function Privacy() {
  useLang();
  if (getLang() === 'en') return (
    <LegalPage title="Privacy policy (beta summary)">
      <p>We process the data you enter to make the app work: account (name, email, optional profile photo), trips, documents, expenses and receipt photos. They are stored on Supabase in an EU data centre (Frankfurt).</p>
      <p>Content shared with the group is visible to the trip members; private documents only to you and the people you assign. Your profile photo is visible to the people in your trips and can be opened by anyone who has its link. Receipts are read on your phone.</p>
      <p>We use services that receive no personal data for weather (Open-Meteo) and exchange rates (ECB via Frankfurter). No advertising, no profiling.</p>
      <p>You can export your data or delete your account at any time from Settings. For any request: {CONTACT}. You can also lodge a complaint with the Italian data protection authority (Garante privacy).</p>
      <p className="tiny muted">The full Italian version prevails.</p>
    </LegalPage>
  );
  return (
    <LegalPage title="Informativa privacy (sintesi beta)">
      <p>Trattiamo i dati che inserisci per far funzionare l'app: account (nome, email, foto profilo facoltativa), viaggi, documenti, spese e foto degli scontrini. Li conserviamo su Supabase in un data center UE (Francoforte).</p>
      <p>La foto profilo è visibile alle persone dei tuoi viaggi e può essere aperta da chi ne conosce il link.</p>
      <p>I contenuti condivisi con il gruppo sono visibili ai membri del viaggio; i documenti privati solo a te e alle persone assegnate. La lettura degli scontrini avviene sul tuo telefono.</p>
      <p>Usiamo servizi senza dati personali per meteo (Open-Meteo) e tassi di cambio (BCE tramite Frankfurter). Niente pubblicità, niente profilazione.</p>
      <p>Puoi esportare i tuoi dati o eliminare l'account in ogni momento da Impostazioni. Per qualsiasi richiesta: {CONTACT}. Puoi anche presentare reclamo al Garante privacy.</p>
    </LegalPage>
  );
}

export function Terms() {
  useLang();
  if (getLang() === 'en') return (
    <LegalPage title="Terms of use (beta summary)">
      <p>The app is a test version: it may contain errors and change. Keep essential travel documents somewhere else too.</p>
      <p>Only upload content you have the right to share; if it concerns other people, let them know. Don't use the app for illegal purposes.</p>
      <p>Expense calculations, including "Simplify debts", are for organising and create no legal obligations; receipt reading can make mistakes. The app does not handle payments.</p>
      <p>To report illegal content or get support: {CONTACT}.</p>
      <p className="tiny muted">The full Italian version prevails.</p>
    </LegalPage>
  );
  return (
    <LegalPage title="Termini di utilizzo (sintesi beta)">
      <p>L'app è in versione di prova: può contenere errori e cambiare. Conserva altrove anche i documenti di viaggio indispensabili.</p>
      <p>Carica solo contenuti che hai il diritto di condividere; se riguardano altre persone, informale. Non usare l'app per scopi illegali.</p>
      <p>I calcoli delle spese, compreso "Semplifica le spese", servono a organizzarsi e non creano obblighi legali; la lettura degli scontrini può sbagliare. L'app non gestisce pagamenti.</p>
      <p>Per segnalare contenuti illegali o per assistenza: {CONTACT}.</p>
    </LegalPage>
  );
}

export function DeleteAccountInfo() {
  useLang();
  if (getLang() === 'en') return (
    <LegalPage title="Deleting your account">
      <p><strong>From the app:</strong> Settings › Delete account. Deletion is immediate: documents you uploaded are deleted and in shared expenses you appear as "Deleted user", so everyone else's balances stay correct.</p>
      <p><strong>Without the app:</strong> email {CONTACT} from your account's address with the subject "Account deletion". We delete the account and related data within 30 days.</p>
      <p>Backup copies are overwritten within 30 days.</p>
    </LegalPage>
  );
  return (
    <LegalPage title="Eliminazione dell'account">
      <p><strong>Dall'app:</strong> Impostazioni › Elimina account. L'eliminazione è immediata: i documenti che hai caricato vengono cancellati e nelle spese condivise compari come "Utente eliminato", così i saldi degli altri restano corretti.</p>
      <p><strong>Senza l'app:</strong> scrivi a {CONTACT} dall'indirizzo email del tuo account con oggetto "Eliminazione account". Eliminiamo l'account e i dati collegati entro 30 giorni.</p>
      <p>Le copie di backup vengono sovrascritte entro 30 giorni.</p>
    </LegalPage>
  );
}

function LegalPage({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="screen no-tabs">
      <header className="row"><Link to="/" className="icon-btn" aria-label={t('Indietro')}><Icon name="back" /></Link><h1 className="display" style={{ fontSize: 24 }}>{title}</h1></header>
      <div className="card stack" style={{ lineHeight: 1.55 }}>{children}</div>
    </div>
  );
}
