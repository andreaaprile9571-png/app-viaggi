import { getLang } from './i18n';
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
  { id: 'trasporti', label: 'Trasporti', bg: '#E3F1ED', fg: '#0E6B58' },
  { id: 'attivita', label: 'Attività', bg: '#FDEBDD', fg: '#C2410C' },
  { id: 'assicurazione', label: 'Assicurazione', bg: '#E9ECF0', fg: '#3D4756' },
  { id: 'personali', label: 'Documenti personali', bg: '#E9ECF0', fg: '#3D4756' },
  { id: 'altro', label: 'Altro', bg: '#E9ECF0', fg: '#3D4756' },
];

export const EXPENSE_CATEGORIES: { id: ExpenseCategory; label: string; bg: string; fg: string }[] = [
  { id: 'cibo', label: 'Cibo', bg: '#FDEBDD', fg: '#9A3412' },
  { id: 'alloggio', label: 'Alloggio', bg: '#E0E9FF', fg: '#1D4ED8' },
  { id: 'trasporti', label: 'Trasporti', bg: '#E3F1ED', fg: '#0E6B58' },
  { id: 'attivita', label: 'Attività', bg: '#EEE7FD', fg: '#6D28D9' },
  { id: 'spesa', label: 'Spesa', bg: '#FEF3C7', fg: '#92400E' },
  { id: 'altro', label: 'Altro', bg: '#E9ECF0', fg: '#3D4756' },
];

export const CURRENCIES = ['EUR', 'USD', 'GBP', 'CHF', 'JPY', 'CZK', 'DKK', 'HUF', 'NOK', 'PLN', 'SEK', 'RON', 'TRY', 'AUD', 'CAD', 'CNY', 'HKD', 'INR', 'MXN', 'BRL', 'THB', 'ZAR', 'ISK', 'SGD', 'KRW', 'NZD', 'IDR', 'ILS', 'PHP', 'MYR'];

export const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36));
