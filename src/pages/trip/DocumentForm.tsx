import { useEffect, useState } from 'react';
import { Avatar, Icon, Switch, toast } from '../../components/ui';
import { DOC_CATEGORIES, uid, errorText } from '../../lib/format';
import { t } from '../../lib/i18n';
import { useTrip } from '../../lib/TripContext';
import { BUCKET, supabase, type DocCategory, type TripDocument } from '../../lib/supabase';
import { set as idbSet } from 'idb-keyval';

const toLocal = (iso: string | null) => (iso ? new Date(new Date(iso).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : '');

export default function DocumentForm({ category, doc, initialFile, onDone }: {
  category?: DocCategory; doc?: TripDocument; initialFile?: File | null; onDone: (id?: string) => void;
}) {
  const { b, refresh } = useTrip();
  const [cat, setCat] = useState<DocCategory>(doc?.category ?? category ?? 'voli');
  const [title, setTitle] = useState(doc?.title ?? '');
  const [startsAt, setStartsAt] = useState(toLocal(doc?.starts_at ?? null));
  const [endsAt, setEndsAt] = useState(toLocal(doc?.ends_at ?? null));
  const [ref, setRef] = useState(doc?.ref_code ?? '');
  const [address, setAddress] = useState(doc?.address ?? '');
  const [notes, setNotes] = useState(doc?.notes ?? '');
  const [shared, setShared] = useState(doc ? doc.visibility === 'group' : (category ?? 'voli') !== 'personali');
  const [assigned, setAssigned] = useState<string[]>(doc ? b.assignees.filter((a) => a.document_id === doc.id).map((a) => a.member_id) : b.me ? [b.me.id] : []);
  const [file, setFile] = useState<File | null>(initialFile ?? null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => { if (!doc && cat === 'personali') setShared(false); }, [cat, doc]);
  useEffect(() => { if (file && !title) setTitle(file.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').slice(0, 80)); }, [file, title]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!b.me) return;
    setBusy(true); setErr(null);
    try {
      let file_path = doc?.file_path ?? null, file_name = doc?.file_name ?? null, mime_type = doc?.mime_type ?? null, size_bytes = doc?.size_bytes ?? null;
      if (file) {
        const ext = (file.name.split('.').pop() || 'bin').toLowerCase().slice(0, 5);
        file_path = `${b.trip.id}/docs/${uid()}.${ext}`;
        const up = await supabase.storage.from(BUCKET).upload(file_path, file, { contentType: file.type || 'application/octet-stream' });
        if (up.error) throw up.error;
        await idbSet(`file:${file_path}`, file);
        file_name = file.name; mime_type = file.type; size_bytes = file.size;
      }
      const row = {
        trip_id: b.trip.id, category: cat, title: title.trim(), starts_at: startsAt ? new Date(startsAt).toISOString() : null,
        ends_at: endsAt ? new Date(endsAt).toISOString() : null, ref_code: ref.trim() || null, address: address.trim() || null,
        notes: notes.trim() || null, visibility: shared ? 'group' : 'private', file_path, file_name, mime_type, size_bytes,
      };
      let id = doc?.id;
      if (doc) {
        const { error } = await supabase.from('documents').update(row).eq('id', doc.id);
        if (error) throw error;
        await supabase.from('document_assignees').delete().eq('document_id', doc.id);
      } else {
        const { data, error } = await supabase.from('documents').insert({ ...row, uploaded_by: b.me.id }).select('id').single();
        if (error) throw error;
        id = data.id;
        await supabase.from('activity').insert({ trip_id: b.trip.id, member_id: b.me.id, kind: 'document', text: `ha caricato ${row.title}` });
      }
      if (assigned.length) {
        const { error } = await supabase.from('document_assignees').insert(assigned.map((m) => ({ document_id: id, member_id: m })));
        if (error) throw error;
      }
      await refresh();
      toast('Documento salvato');
      onDone(id);
    } catch (e) {
      setErr(errorText(e));
    } finally { setBusy(false); }
  }

  const toggle = (id: string) => setAssigned((a) => (a.includes(id) ? a.filter((x) => x !== id) : [...a, id]));

  return (
    <form className="stack" onSubmit={save}>
      <div className="row">
        <label className="btn btn-ghost grow" style={{ position: 'relative' }}>
          <Icon name="upload" size={18} />{file ? 'Cambia file' : doc?.file_name ? 'Sostituisci file' : t('Scegli file')}
          <input type="file" accept="application/pdf,image/*,.pkpass" style={{ position: 'absolute', opacity: 0, inset: 0 }} onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        </label>
        <label className="btn btn-ghost" style={{ position: 'relative' }} aria-label={t('Scatta foto')}>
          <Icon name="camera" size={18} />
          <input type="file" accept="image/*" capture="environment" style={{ position: 'absolute', opacity: 0, inset: 0 }} onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        </label>
      </div>
      <p className="tiny muted">{file ? `${file.name} · ${(file.size / 1024).toFixed(0)} KB` : doc?.file_name ?? 'PDF o foto. Dal selettore puoi scegliere anche file da Google Drive, Dropbox o iCloud.'}</p>

      <div className="field"><label htmlFor="d-cat">{t('Categoria')}</label>
        <select id="d-cat" className="input" value={cat} onChange={(e) => setCat(e.target.value as DocCategory)}>
          {DOC_CATEGORIES.map((c) => <option key={c.id} value={c.id}>{t(c.label)}</option>)}
        </select></div>
      <div className="field"><label htmlFor="d-title">{t('Titolo')}</label>
        <input id="d-title" className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="es. Volo Torino → Lisbona" maxLength={160} required /></div>
      <div className="pair stacked">
        <div className="field"><label htmlFor="d-start">{cat === 'alloggi' ? 'Check-in' : t('Data e ora')}</label>
          <input id="d-start" className="input" type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} /></div>
        <div className="field"><label htmlFor="d-end">{cat === 'alloggi' ? 'Check-out' : 'Fine (facoltativa)'}</label>
          <input id="d-end" className="input" type="datetime-local" value={endsAt} min={startsAt} onChange={(e) => setEndsAt(e.target.value)} /></div>
      </div>
      <div className="field"><label htmlFor="d-ref">{t('Codice prenotazione')}</label>
        <input id="d-ref" className="input" value={ref} onChange={(e) => setRef(e.target.value)} autoCapitalize="characters" maxLength={40} /></div>
      <div className="field"><label htmlFor="d-addr">{t('Indirizzo')}</label>
        <input id="d-addr" className="input" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Si apre in Google Maps / Apple Mappe" /></div>
      <div className="field"><label htmlFor="d-notes">{t('Note')}</label>
        <textarea id="d-notes" className="input" value={notes} onChange={(e) => setNotes(e.target.value)} /></div>

      <div className="field"><span className="label">{t('Per chi')}</span>
        <div className="chips" role="group" aria-label={t('Per chi')}>
          {b.members.map((m) => (
            <button key={m.id} type="button" className="chip teal" aria-pressed={assigned.includes(m.id)} onClick={() => toggle(m.id)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Avatar m={m} />{m.id === b.me?.id ? 'Io' : m.display_name}
            </button>
          ))}
        </div></div>
      <div className="card row" style={{ background: 'var(--bg)' }}>
        <span className="col grow"><label htmlFor="d-vis" className="strong small">{t('Visibile a tutto il gruppo')}</label>
          <span className="tiny muted">{shared ? 'Tutti i membri lo vedono' : 'Solo tu e le persone assegnate'}</span></span>
        <Switch id="d-vis" checked={shared} onChange={setShared} />
      </div>
      {err && <p className="error">{err}</p>}
      <button className="btn btn-teal btn-block" disabled={busy || !title.trim()}>{busy ? 'Salvataggio…' : t('Salva')}</button>
    </form>
  );
}
