import { t } from './i18n';
// Integrazioni gratuite senza account: geocoding e meteo (Open-Meteo), tassi BCE (Frankfurter).
import { get, set } from 'idb-keyval';

export type Place = { name: string; country: string; lat: number; lon: number; label: string };

export async function searchPlaces(q: string, lang = 'it'): Promise<Place[]> {
  if (q.trim().length < 2) return [];
  const r = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=6&language=${lang}&format=json`);
  const j = await r.json();
  return (j.results ?? []).map((p: { name: string; country?: string; admin1?: string; latitude: number; longitude: number }) => ({
    name: p.name, country: p.country ?? '', lat: p.latitude, lon: p.longitude,
    label: [p.name, p.admin1, p.country].filter(Boolean).join(', '),
  }));
}

export type DayWeather = { date: string; max: number; min: number; code: number };

export async function weather(lat: number, lon: number): Promise<DayWeather[]> {
  const key = `wx:${lat.toFixed(2)},${lon.toFixed(2)}`;
  const cached = await get<{ at: number; days: DayWeather[] }>(key);
  if (cached && Date.now() - cached.at < 3 * 3600_000) return cached.days;
  const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=16`);
  const j = await r.json();
  const days: DayWeather[] = (j.daily?.time ?? []).map((d: string, i: number) => ({
    date: d, max: Math.round(j.daily.temperature_2m_max[i]), min: Math.round(j.daily.temperature_2m_min[i]), code: j.daily.weather_code[i],
  }));
  await set(key, { at: Date.now(), days });
  return days;
}

export function weatherLabel(code: number): { icon: string; text: string } {
  if (code === 0) return { icon: 'sun', text: t('Sereno') };
  if (code <= 3) return { icon: 'cloud-sun', text: t('Poco nuvoloso') };
  if (code <= 48) return { icon: 'cloud', text: t('Nebbia') };
  if (code <= 67 || (code >= 80 && code <= 82)) return { icon: 'rain', text: t('Pioggia') };
  if (code <= 77 || code === 85 || code === 86) return { icon: 'snow', text: t('Neve') };
  return { icon: 'storm', text: t('Temporale') };
}

/** Tasso di cambio di riferimento BCE: quante unità di `to` vale 1 unità di `from`. */
export async function fxRate(from: string, to: string, date?: string): Promise<number> {
  if (from === to) return 1;
  const day = date && date <= new Date().toISOString().slice(0, 10) ? date : 'latest';
  const key = `fx:${day}:${from}:${to}`;
  const cached = await get<number>(key);
  if (cached) return cached;
  const r = await fetch(`https://api.frankfurter.dev/v1/${day}?base=${from}&symbols=${to}`);
  if (!r.ok) throw new Error('fx');
  const j = await r.json();
  const rate = j.rates?.[to];
  if (!rate) throw new Error('fx');
  await set(key, rate);
  return rate;
}

export const mapsLink = (q: string) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
export const appleMapsLink = (q: string) => `https://maps.apple.com/?q=${encodeURIComponent(q)}`;
export const whatsappLink = (text: string) => `https://wa.me/?text=${encodeURIComponent(text)}`;
export const paypalLink = (handle: string, amount: number, cur: string) => {
  const h = handle.replace(/^https?:\/\/(www\.)?paypal\.me\//i, '').replace(/\/.*$/, '');
  return `https://paypal.me/${encodeURIComponent(h)}/${amount.toFixed(2)}${cur}`;
};
