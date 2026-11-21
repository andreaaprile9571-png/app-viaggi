import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Avatar, DOC_ICON, Icon, Sheet, Switch, toast } from '../../components/ui';
import { fileUrl, isFileCached } from '../../lib/api';
import { dateLong, dateTime, DOC_CATEGORIES } from '../../lib/format';
import { t } from '../../lib/i18n';
import { appleMapsLink, mapsLink } from '../../lib/integrations';
import { useTrip } from '../../lib/TripContext';
import { BUCKET, supabase } from '../../lib/supabase';
import DocumentForm from './DocumentForm';

export default function DocumentDetail() {
  const { docId } = useParams();
  const nav = useNavigate();
  const { b, refresh, memberName } = useTrip();
  const doc = b.documents.find((d) => d.id === docId);
  const [url, setUrl] = useState<string | null>(null);
  const [cached, setCached] = useState(false);
  const [editing, setEditing] = useState(false);
  const [viewing, setViewing] = useState(false);

  useEffect(() => { if (doc?.file_path) isFileCached(doc.file_path).then(setCached); }, [doc?.file_path]);

  if (!doc) return <div className="screen no-tabs"><Link to=".." relative="path" className="icon-btn" aria-label="Indietro"><Icon name="back" /></Link><p className="muted">Documento non trovato o non visibile per te.</p></div>;
  const cat = DOC_CATEGORIES.find((c) => c.id === doc.category)!;
  const assignees = b.assignees.filter((a) => a.document_id === doc.id).map((a) => b.members.find((m) => m.id === a.member_id)!).filter(Boolean);
  const canEdit = doc.uploaded_by === b.me?.id || b.me?.role === 'organizer';
  const isImg = doc.mime_type?.startsWith('image/');

  async function open() {
    if (!doc?.file_path) return;
    try { const u = await fileUrl(doc.file_path); setUrl(u); setCached(true); setViewing(true); }
    catch { toast('File non disponibile offline'); }
  }
  async function toggleVisibility(v: boolean) {
    await supabase.from('documents').update({ visibility: v ? 'group' : 'private' }).eq('id', doc!.id);
    refresh();
  }
  async function remove() {
    if (!confirm('Eliminare questo documento per tutto il gruppo?')) return;
    if (doc!.file_path) await supabase.storage.from(BUCKET).remove([doc!.file_path]);
    await supabase.from('documents').delete().eq('id', doc!.id);
    await refresh();
    nav('..', { relative: 'path' });
  }

  return (
    <div className="screen no-tabs">
      <header className="between">
        <Link to=".." relative="path" className="icon-btn" aria-label="Torna ai documenti"><Icon name="back" /></Link>
        <span className="pill" style={{ background: cat.bg, color: cat.fg }}><Icon name={DOC_ICON[doc.category]} size={14} />{t(cat.label)}</span>
        {canEdit ? <button className="icon-btn" onClick={() => setEditing(true)} aria-label="Modifica"><Icon name="more" /></button> : <span style={{ width: 44 }} />}
      </header>

      <section className="card stack" style={{ padding: 20 }}>
        <h1 className="display" style={{ fontSize: 24 }}>{doc.title}</h1>
        <p className="muted small">{doc.starts_at ? (doc.category === 'alloggi' ? `${dateLong(doc.starts_at)} → ${dateLong(doc.ends_at)}` : dateTime(doc.starts_at)) : 'Senza data'}</p>
        {doc.ref_code && (
          <div className="between" style={{ borderTop: '2px dashed var(--line)', paddingTop: 14 }}>
            <div className="col"><span className="tiny muted">{t('Codice prenotazione')}</span><span style={{ fontSize: 18, fontWeight: 600, letterSpacing: 1.5 }}>{doc.ref_code}</span></div>
            <button className="btn btn-ghost" onClick={() => { navigator.clipboard.writeText(doc.ref_code!); toast(t('Copiato')); }}><Icon name="copy" size={16} />{t('Copia')}</button>
          </div>
        )}
        {doc.address && (
          <div className="row" style={{ borderTop: '1px solid var(--line)', paddingTop: 12 }}>
            <Icon name="map" size={18} className="muted" /><span className="grow small">{doc.address}</span>
            <a className="small strong" href={mapsLink(doc.address)} target="_blank" rel="noreferrer">Maps</a>
            <a className="small strong" href={appleMapsLink(doc.address)} target="_blank" rel="noreferrer">Mappe</a>
          </div>
        )}
        {doc.notes && <p className="small" style={{ whiteSpace: 'pre-wrap', borderTop: '1px solid var(--line)', paddingTop: 12 }}>{doc.notes}</p>}
      </section>

      {doc.file_path && (
        <button className="linkcard" onClick={open}>
          <span className="icon-tile" style={{ background: 'var(--bg)' }}><Icon name="doc" /></span>
          <span className="col grow"><span className="strong small ellipsis">{doc.file_name}</span>
            <span className="tiny muted">{doc.size_bytes ? `${Math.round(doc.size_bytes / 1024)} KB` : ''}{cached ? ` · ${t('Salvato offline')}` : ''}</span></span>
          <span className="strong small" style={{ color: 'var(--teal)' }}>{t('Apri')}</span>
        </button>
      )}

      <section className="stack">
        <h2 className="eyebrow">{t('Per chi')}</h2>
        <ul className="list">
          {assignees.map((m) => <li key={m.id}><Avatar m={m} /><span className="grow">{m.id === b.me?.id ? `${m.display_name} (tu)` : m.display_name}</span></li>)}
          {!assignees.length && <li className="small muted">Per tutto il gruppo</li>}
        </ul>
      </section>

      <section className="card row">
        <span className="col grow"><label htmlFor="vis" className="strong small">{t('Visibile a tutto il gruppo')}</label>
          <span className="tiny muted">Caricato da {memberName(doc.uploaded_by)}</span></span>
        <Switch id="vis" checked={doc.visibility === 'group'} onChange={toggleVisibility} />
      </section>
      {canEdit && <button className="btn btn-danger btn-block" onClick={remove}><Icon name="trash" size={18} />{t('Elimina')}</button>}

      {viewing && url && (
        <Sheet title={doc.file_name ?? doc.title} onClose={() => setViewing(false)}>
          {isImg ? <img src={url} alt={doc.title} style={{ width: '100%', borderRadius: 16 }} /> : <iframe className="viewer" src={url} title={doc.title} />}
          <a className="btn btn-ghost btn-block" href={url} download={doc.file_name ?? 'documento'}><Icon name="download" size={18} />Scarica / apri con un'altra app</a>
        </Sheet>
      )}
      {editing && <Sheet title="Modifica documento" onClose={() => setEditing(false)}><DocumentForm doc={doc} onDone={() => setEditing(false)} /></Sheet>}
    </div>
  );
}
