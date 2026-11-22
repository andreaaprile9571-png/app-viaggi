// Calendario del viaggio in formato ICS: chi ha il link (con token segreto) si iscrive da Google, Apple, Outlook.
// Contiene solo date, orari e luoghi dei documenti condivisi con il gruppo: nessun file, nessun documento privato.
import { createClient } from 'npm:@supabase/supabase-js@2';

const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
const day = (s: string) => s.replace(/-/g, '');
const fold = (line: string) => {
  const out: string[] = [];
  let rest = line;
  while (rest.length > 74) { out.push(rest.slice(0, 74)); rest = ' ' + rest.slice(74); }
  out.push(rest);
  return out.join('\r\n');
};
const CAT: Record<string, string> = {
  voli: '✈️', alloggi: '🏨', trasporti: '🚆', attivita: '🎟️', assicurazione: '🛡️', personali: '🪪', altro: '📄',
};

Deno.serve(async (req) => {
  const token = new URL(req.url).searchParams.get('token') ?? '';
  if (!/^[a-f0-9]{36}$/.test(token)) return new Response('Not found', { status: 404 });

  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
  const { data: trip } = await db.from('trips').select('id,name,destination,start_date,end_date').eq('calendar_token', token).maybeSingle();
  if (!trip) return new Response('Not found', { status: 404 });
  const { data: docs } = await db.from('documents')
    .select('id,category,title,starts_at,ends_at,ref_code,address,updated:created_at')
    .eq('trip_id', trip.id).eq('visibility', 'group').not('starts_at', 'is', null);

  const now = stamp(new Date());
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Shipshape//IT', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    `X-WR-CALNAME:${esc(trip.name)}`, 'REFRESH-INTERVAL;VALUE=DURATION:PT2H', 'X-PUBLISHED-TTL:PT2H'];

  if (trip.start_date) {
    const end = new Date((trip.end_date ?? trip.start_date) + 'T00:00:00Z');
    end.setUTCDate(end.getUTCDate() + 1);
    lines.push('BEGIN:VEVENT', `UID:trip-${trip.id}`, `DTSTAMP:${now}`, `DTSTART;VALUE=DATE:${day(trip.start_date)}`,
      `DTEND;VALUE=DATE:${end.toISOString().slice(0, 10).replace(/-/g, '')}`, `SUMMARY:${esc('🧳 ' + trip.name)}`,
      ...(trip.destination ? [`LOCATION:${esc(trip.destination)}`] : []), 'TRANSP:TRANSPARENT', 'END:VEVENT');
  }
  for (const d of docs ?? []) {
    const start = new Date(d.starts_at);
    const isStay = d.category === 'alloggi';
    const end = d.ends_at ? new Date(d.ends_at) : new Date(start.getTime() + (isStay ? 0 : 60) * 60000);
    const desc = [d.ref_code ? `Codice: ${d.ref_code}` : '', 'Apri il documento nell\'app Shipshape.'].filter(Boolean).join('\n');
    if (isStay) {
      lines.push('BEGIN:VEVENT', `UID:doc-${d.id}-in`, `DTSTAMP:${now}`, `DTSTART:${stamp(start)}`, `DTEND:${stamp(new Date(start.getTime() + 3600000))}`,
        `SUMMARY:${esc(`${CAT[d.category]} Check-in · ${d.title}`)}`, ...(d.address ? [`LOCATION:${esc(d.address)}`] : []), `DESCRIPTION:${esc(desc)}`, 'END:VEVENT');
      if (d.ends_at) lines.push('BEGIN:VEVENT', `UID:doc-${d.id}-out`, `DTSTAMP:${now}`, `DTSTART:${stamp(end)}`, `DTEND:${stamp(new Date(end.getTime() + 3600000))}`,
        `SUMMARY:${esc(`${CAT[d.category]} Check-out · ${d.title}`)}`, ...(d.address ? [`LOCATION:${esc(d.address)}`] : []), 'END:VEVENT');
    } else {
      lines.push('BEGIN:VEVENT', `UID:doc-${d.id}`, `DTSTAMP:${now}`, `DTSTART:${stamp(start)}`, `DTEND:${stamp(end)}`,
        `SUMMARY:${esc(`${CAT[d.category] ?? ''} ${d.title}`)}`, ...(d.address ? [`LOCATION:${esc(d.address)}`] : []), `DESCRIPTION:${esc(desc)}`,
        ...(d.category === 'voli' ? ['BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:Check-in online', 'TRIGGER:-PT24H', 'END:VALARM'] : []), 'END:VEVENT');
    }
  }
  lines.push('END:VCALENDAR');
  return new Response(lines.map(fold).join('\r\n'), {
    headers: { 'Content-Type': 'text/calendar; charset=utf-8', 'Content-Disposition': `inline; filename="viaggio.ics"`, 'Cache-Control': 'max-age=900' },
  });
});
