import { getLang, t } from './i18n';
import type { DocCategory, ExpenseCategory } from './supabase';

const locale = () => (getLang() === 'en' ? 'en-GB' : 'it-IT');

export const money = (v: number, cur = 'EUR') =>
  new Intl.NumberFormat(locale(), { style: 'currency', currency: cur }).format(v);

export const dateShort = (d: string | null | undefined) =>
  d ? new Intl.DateTimeFormat(locale(), { day: 'numeric', month: 'short' }).format(new Date(d)) : '';

export const dateLong = (d: string | null | undefined) =>
  d ? new Intl.DateTimeFormat(locale(), { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(d)) : '';

export const dateTime = (d: string | null | undefined) =>
  d ? new Intl.DateTimeFormat(locale(), { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(d)) : '';

export const range = (a: string | null, b: string | null) => {
  if (!a) return '';
  if (!b || a === b) return dateLong(a);
  return `${dateShort(a)} – ${dateLong(b)}`;
};

export const daysUntil = (d: string | null) => {
  if (!d) return null;
  const ms = new Date(d + 'T00:00:00').getTime() - new Date(new Date().toDateString()).getTime();
  return Math.round(ms / 86400000);
};

export const relTime = (d: string) => {
  const s = (Date.now() - new Date(d).getTime()) / 1000;
  const rtf = new Intl.RelativeTimeFormat(locale(), { numeric: 'auto' });
  if (s < 3600) return rtf.format(-Math.max(1, Math.round(s / 60)), 'minute');
  if (s < 86400) return rtf.format(-Math.round(s / 3600), 'hour');
  return rtf.format(-Math.round(s / 86400), 'day');
};

export const DOC_CATEGORIES: { id: DocCategory; label: string; bg: string; fg: string }[] = [
  { id: 'voli', label: 'Voli', bg: '#E0E9FF', fg: '#1D4ED8' },
  { id: 'alloggi', label: 'Alloggi', bg: '#EEE7FD', fg: '#6D28D9' },
  { id: 'trasporti', label: 'Trasporti', bg: '#DCE7DE', fg: '#2F5D50' },
  { id: 'attivita', label: 'Attività', bg: '#F3DDD2', fg: '#9C4426' },
  { id: 'assicurazione', label: 'Assicurazione', bg: '#E6E0D2', fg: '#45503F' },
  { id: 'personali', label: 'Documenti personali', bg: '#E6E0D2', fg: '#45503F' },
  { id: 'altro', label: 'Altro', bg: '#E6E0D2', fg: '#45503F' },
];

export const EXPENSE_CATEGORIES: { id: ExpenseCategory; label: string; bg: string; fg: string }[] = [
  { id: 'cibo', label: 'Cibo', bg: '#F3DDD2', fg: '#7E3416' },
  { id: 'alloggio', label: 'Alloggio', bg: '#E0E9FF', fg: '#1D4ED8' },
  { id: 'trasporti', label: 'Trasporti', bg: '#DCE7DE', fg: '#2F5D50' },
  { id: 'attivita', label: 'Attività', bg: '#EEE7FD', fg: '#6D28D9' },
  { id: 'spesa', label: 'Spesa', bg: '#FEF3C7', fg: '#92400E' },
  { id: 'altro', label: 'Altro', bg: '#E6E0D2', fg: '#45503F' },
];

export const CURRENCIES = ['EUR', 'USD', 'GBP', 'CHF', 'JPY', 'CZK', 'DKK', 'HUF', 'NOK', 'PLN', 'SEK', 'RON', 'TRY', 'AUD', 'CAD', 'CNY', 'HKD', 'INR', 'MXN', 'BRL', 'THB', 'ZAR', 'ISK', 'SGD', 'KRW', 'NZD', 'IDR', 'ILS', 'PHP', 'MYR'];

export const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36));

/** Testo leggibile di un errore: gli errori di Supabase sono oggetti semplici con "message". */
export function errorText(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (e && typeof e === 'object') {
    const o = e as { message?: unknown; error_description?: unknown; error?: unknown; details?: unknown };
    const m = o.message ?? o.error_description ?? o.error ?? o.details;
    if (typeof m === 'string' && m) {
      if (/row-level security/i.test(m)) return t('Non hai i permessi per questa operazione. Ricarica la pagina e riprova.');
      if (/failed to fetch|network/i.test(m)) return t('Connessione assente. Riprova quando sei online.');
      return m;
    }
  }
  return typeof e === 'string' ? e : t('Errore imprevisto. Riprova.');
}

/** Parole che suggeriscono la categoria di una spesa (italiano, inglese, qualche nome di catena o servizio). */
const CATEGORY_WORDS: [ExpenseCategory, string[]][] = [
  ['alloggio', ['hotel', 'airbnb', 'ostello', 'hostel', 'b&b', 'bnb', 'albergo', 'booking', 'appartamento', 'apartment', 'campeggio', 'camping', 'tassa di soggiorno', 'tourist tax', 'alloggio', 'pernottamento', 'resort', 'agriturismo', 'guesthouse']],
  ['trasporti', ['taxi', 'uber', 'bolt', 'free now', 'treno', 'train', 'trenitalia', 'italo', 'bus', 'autobus', 'pullman', 'flixbus', 'metro', 'metropolitana', 'tram', 'volo', 'aereo', 'flight', 'ryanair', 'easyjet', 'vueling', 'ita airways', 'benzina', 'carburante', 'gasolio', 'diesel', 'fuel', 'parcheggio', 'parking', 'pedaggio', 'autostrada', 'toll', 'noleggio auto', 'car rental', 'traghetto', 'ferry', 'aliscafo', 'funivia', 'navetta', 'shuttle', 'transfer', 'monopattino', 'scooter']],
  ['spesa', ['supermercato', 'supermarket', 'spesa', 'groceries', 'grocery', 'alimentari', 'minimarket', 'mercato', 'market', 'lidl', 'aldi', 'carrefour', 'conad', 'coop', 'esselunga', 'eurospin', 'pingo doce', 'continente', 'mercadona', 'tesco', 'spar', 'auchan', 'farmacia', 'pharmacy']],
  ['attivita', ['gita', 'museo', 'museum', 'tour', 'ingresso', 'entrance', 'entry', 'biglietto', 'biglietti', 'ticket', 'escursione', 'excursion', 'concerto', 'concert', 'spettacolo', 'teatro', 'theatre', 'cinema', 'parco', 'zoo', 'acquario', 'aquarium', 'spa', 'terme', 'lezione', 'corso', 'surf', 'kayak', 'noleggio bici', 'bike rental', 'visita', 'guida', 'guided', 'castello', 'palazzo', 'mostra', 'discoteca', 'club', 'lido', 'ombrellone']],
  ['cibo', ['cena', 'pranzo', 'colazione', 'merenda', 'aperitivo', 'aperi', 'ristorante', 'restaurant', 'trattoria', 'osteria', 'pizzeria', 'pizza', 'sushi', 'burger', 'hamburger', 'kebab', 'panino', 'panini', 'piadina', 'brunch', 'snack', 'bar', 'caffe', 'cafe', 'coffee', 'cappuccino', 'gelato', 'gelateria', 'pasticceria', 'bakery', 'birra', 'beer', 'vino', 'wine', 'cocktail', 'drink', 'drinks', 'tapas', 'dinner', 'lunch', 'breakfast', 'food', 'mcdonald', 'starbucks', 'burger king', 'pastel de nata', 'cibo']],
];
const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/** Indovina la categoria dalla descrizione: null se nessuna parola la suggerisce. */
export function guessCategory(text: string): ExpenseCategory | null {
  const s = ` ${norm(text).replace(/[^a-z0-9&]+/g, ' ')} `;
  if (s.trim().length < 2) return null;
  for (const [cat, words] of CATEGORY_WORDS) {
    for (const w of words) {
      const k = norm(w);
      // le parole corte devono essere intere ("bar" non deve scattare dentro "barca")
      if (k.length <= 4 ? s.includes(` ${k} `) || s.includes(` ${k}s `) : s.includes(k)) return cat;
    }
  }
  return null;
}
