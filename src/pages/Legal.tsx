import { Link } from 'react-router-dom';
import { Icon } from '../components/ui';

// Versione breve per la beta. Il testo completo, in revisione legale, va pubblicato a questi indirizzi prima del lancio.
const CONTACT = (import.meta.env.VITE_CONTACT_EMAIL as string) || 'privacy@[dominio]';

export function Privacy() {
  return (
    <LegalPage title="Informativa privacy (sintesi beta)">
      <p>Trattiamo i dati che inserisci per far funzionare l'app: account (nome, email), viaggi, documenti, spese e foto degli scontrini. Li conserviamo su Supabase in un data center UE (Francoforte).</p>
      <p>I contenuti condivisi con il gruppo sono visibili ai membri del viaggio; i documenti privati solo a te e alle persone assegnate. La lettura degli scontrini avviene sul tuo telefono.</p>
      <p>Usiamo servizi senza dati personali per meteo (Open-Meteo) e tassi di cambio (BCE tramite Frankfurter). Niente pubblicità, niente profilazione.</p>
      <p>Puoi esportare i tuoi dati o eliminare l'account in ogni momento da Impostazioni. Per qualsiasi richiesta: {CONTACT}. Puoi anche presentare reclamo al Garante privacy.</p>
    </LegalPage>
  );
}

export function Terms() {
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
      <header className="row"><Link to="/" className="icon-btn" aria-label="Indietro"><Icon name="back" /></Link><h1 className="display" style={{ fontSize: 24 }}>{title}</h1></header>
      <div className="card stack" style={{ lineHeight: 1.55 }}>{children}</div>
    </div>
  );
}
