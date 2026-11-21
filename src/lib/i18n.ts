// Testi dell'app: l'italiano è la lingua di partenza, l'inglese è una traduzione per chiave.
// t('Spese') restituisce 'Expenses' se la lingua è inglese, altrimenti il testo italiano.
import { useSyncExternalStore } from 'react';

const EN: Record<string, string> = {
  'I tuoi viaggi': 'Your trips', 'Ciao': 'Hi', 'Nuovo viaggio': 'New trip', 'Entra con un codice': 'Join with a code',
  'In programma': 'Upcoming', 'Passati': 'Past', 'In corso': 'Ongoing', 'persone': 'people', 'doc': 'docs',
  'Panoramica': 'Overview', 'Documenti': 'Documents', 'Spese': 'Expenses', 'Gruppo': 'Group', 'Invita': 'Invite',
  'Il tuo prossimo documento': 'Your next document', 'Attività recenti': 'Recent activity', 'Spese del gruppo': 'Group expenses',
  'Ti devono': 'You are owed', 'Devi dare': 'You owe', 'Sei in pari': 'You are settled up',
  'Tutti': 'All', 'Solo i miei': 'Only mine', 'Aggiungi': 'Add', 'Voli': 'Flights', 'Alloggi': 'Stays', 'Trasporti': 'Transport',
  'Attività': 'Activities', 'Assicurazione': 'Insurance', 'Documenti personali': 'Personal documents', 'Altro': 'Other',
  'Privati: li vedi solo tu': 'Private: only you can see them', 'Nuovo documento': 'New document', 'Titolo': 'Title',
  'Categoria': 'Category', 'Data e ora': 'Date and time', 'Codice prenotazione': 'Booking code', 'Indirizzo': 'Address',
  'Note': 'Notes', 'Visibile a tutto il gruppo': 'Visible to the whole group', 'Per chi': 'For whom', 'Salva': 'Save',
  'File': 'File', 'Scegli file': 'Choose file', 'Scatta foto': 'Take photo', 'Apri': 'Open', 'Elimina': 'Delete',
  'Copia': 'Copy', 'Copiato': 'Copied', 'Totale del gruppo': 'Group total', 'La tua quota': 'Your share',
  'Vedi saldi': 'See balances', 'Semplifica le spese': 'Simplify debts', 'Scansiona scontrino': 'Scan receipt',
  'Nuova spesa': 'New expense', 'Importo': 'Amount', 'Pagato da': 'Paid by', 'Dividi tra': 'Split between',
  'Uguale': 'Equal', 'Importi': 'Amounts', 'Quote': 'Shares', 'Salva spesa': 'Save expense', 'Saldi': 'Balances',
  'Per pareggiare i conti': 'To settle up', 'Segna come pagato': 'Mark as paid', 'Esporta': 'Export',
  'deve ricevere': 'gets back', 'deve dare': 'owes', 'dà a': 'pays', 'Tutto saldato': 'All settled',
  'Invita con link o QR': 'Invite with link or QR', 'Copia link': 'Copy link', 'Condividi su WhatsApp': 'Share on WhatsApp',
  'Aggiungi un ospite senza account (solo per le spese)': 'Add a guest without an account (expenses only)',
  'Organizzatore': 'Organizer', 'Membro': 'Member', 'Ospite · senza account': 'Guest · no account',
  'Impostazioni': 'Settings', 'Esci': 'Sign out', 'Elimina account': 'Delete account', 'Esporta i miei dati': 'Export my data',
  'Accedi': 'Sign in', 'Registrati': 'Sign up', 'Email': 'Email', 'Password': 'Password', 'Il tuo nome': 'Your name',
  'Calendario del viaggio': 'Trip calendar', 'Meteo a destinazione': 'Weather at destination', 'Lingua': 'Language',
  'Importa da Splitwise o Tricount': 'Import from Splitwise or Tricount', 'Esporta Excel': 'Export Excel', 'Esporta CSV': 'Export CSV',
  'Sei offline: vedi i dati salvati sul telefono': 'You are offline: showing data saved on this phone',
  'spese in attesa di invio': 'expenses waiting to sync', 'Destinazione': 'Destination', 'Dal': 'From', 'Al': 'To',
  'Valuta': 'Currency', 'Crea viaggio': 'Create trip', 'Entra nel viaggio': 'Join trip', 'Codice invito': 'Invite code',
  'Annulla': 'Cancel', 'Chiudi': 'Close', 'Cibo': 'Food', 'Alloggio': 'Accommodation', 'Spesa': 'Groceries',
  'Letto dallo scontrino': 'Read from receipt', 'Sto leggendo lo scontrino…': 'Reading the receipt…',
  'Profilo e pagamenti': 'Profile and payments', 'Link PayPal.me': 'PayPal.me link', 'IBAN': 'IBAN',
  'Paga con PayPal': 'Pay with PayPal', 'Copia IBAN': 'Copy IBAN', 'Salvato offline': 'Saved offline',
  'Nessun documento in questa categoria.': 'No documents in this category.', 'Nessuna spesa ancora.': 'No expenses yet.',
  'Mappa': 'Map', 'Privacy': 'Privacy', 'Termini di utilizzo': 'Terms of use',
};

type Lang = 'it' | 'en';
let lang: Lang = (localStorage.getItem('lang') as Lang) || 'it';
const listeners = new Set<() => void>();

export function setLang(l: Lang) { lang = l; localStorage.setItem('lang', l); document.documentElement.lang = l; listeners.forEach((f) => f()); }
export function getLang() { return lang; }
export function t(s: string) { return lang === 'en' ? EN[s] ?? s : s; }
export function useLang() {
  return useSyncExternalStore((cb) => { listeners.add(cb); return () => listeners.delete(cb); }, () => lang);
}
