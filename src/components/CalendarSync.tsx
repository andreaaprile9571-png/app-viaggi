import { useState } from 'react';
import { Icon, toast } from './ui';
import { t } from '../lib/i18n';
import { isNative, openWithApp } from '../lib/native';
import { SUPABASE_URL } from '../lib/supabase';

const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
const isIOS = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
const isAndroid = isNative || /Android/.test(ua);
const isMobile = isIOS || isAndroid;

/**
 * Collega il calendario del viaggio.
 * - iPhone/Mac/Outlook: iscrizione (webcal) che si aggiorna da sola.
 * - Android: Google Calendar non accetta iscrizioni dal telefono, quindi importiamo il file .ics nell'app Calendario
 *   e diamo il link da aggiungere una volta da computer per avere gli aggiornamenti automatici.
 */
export default function CalendarSync({ token, tripName }: { token: string; tripName: string }) {
  const httpsUrl = `${SUPABASE_URL}/functions/v1/calendar?token=${token}`;
  const webcalUrl = httpsUrl.replace(/^https:/, 'webcal:');
  const googleUrl = `https://calendar.google.com/calendar/render?cid=${encodeURIComponent(webcalUrl)}`;
  const [busy, setBusy] = useState(false);
  const [help, setHelp] = useState(false);

  async function importFile() {
    setBusy(true);
    try {
      const r = await fetch(httpsUrl, { cache: 'no-store' });
      if (!r.ok) throw new Error(String(r.status));
      const blob = new Blob([await r.text()], { type: 'text/calendar' });
      await openWithApp(blob, `${tripName}.ics`);
    } catch { toast(t('Impossibile scaricare il calendario: sei online?')); }
    finally { setBusy(false); }
  }
  async function copy() {
    try { await navigator.clipboard.writeText(httpsUrl); toast(t('Link copiato')); } catch { setHelp(true); }
  }

  return (
    <div className="stack">
      <div className="card row">
        <span className="icon-tile" style={{ background: 'var(--blue-soft)', color: 'var(--blue)' }}><Icon name="calendar" /></span>
        <span className="col grow">
          <span className="strong small">{t('Voli, alloggi e attività nel tuo calendario')}</span>
          <span className="tiny muted">{isAndroid ? t('Su Android: aggiungi gli eventi ora; per gli aggiornamenti automatici usa il link da computer.') : t('Si aggiorna da solo quando il gruppo aggiunge documenti.')}</span>
        </span>
      </div>
      <div className="row" style={{ flexWrap: 'wrap' }}>
        {isAndroid ? (
          <button className="btn btn-teal grow" onClick={importFile} disabled={busy}><Icon name="calendar" size={18} />{busy ? t('Preparo…') : t('Aggiungi al calendario')}</button>
        ) : (
          <a className="btn btn-teal grow" href={webcalUrl}><Icon name="calendar" size={18} />{isIOS ? t('Aggiungi a Calendario') : 'Apple / Outlook'}</a>
        )}
        {!isMobile && <a className="btn btn-ghost grow" href={googleUrl} target="_blank" rel="noreferrer">Google Calendar</a>}
        <button className="btn btn-ghost grow" onClick={copy}><Icon name="copy" size={16} />{t('Copia link')}</button>
      </div>
      <button className="small" style={{ background: 'none', border: 'none', color: 'var(--teal)', textAlign: 'left', padding: 0, minHeight: 32 }} onClick={() => setHelp((h) => !h)} aria-expanded={help}>
        {help ? t('Nascondi istruzioni') : t('Come iscriversi con Google Calendar')}
      </button>
      {help && (
        <ol className="small muted" style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <li>{t('Da un computer apri calendar.google.com.')}</li>
          <li>{t('Accanto a «Altri calendari» tocca + e scegli «Da URL».')}</li>
          <li>{t('Incolla il link del viaggio e conferma: il calendario compare anche sul telefono.')}</li>
          <li className="tiny" style={{ overflowWrap: 'anywhere', userSelect: 'all' }}>{httpsUrl}</li>
        </ol>
      )}
    </div>
  );
}
