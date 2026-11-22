import { useRef, useState } from 'react';
import { Avatar, Icon, toast } from './ui';
import { errorText } from '../lib/format';
import { t } from '../lib/i18n';
import { AVATAR_BUCKET, supabase } from '../lib/supabase';

/** Ritaglia al centro un quadrato e lo riduce a 384 px in JPEG: foto leggere e sempre tonde nell'avatar. */
async function squareJpeg(file: Blob, size = 384): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const side = Math.min(bmp.width, bmp.height);
  const canvas = document.createElement('canvas');
  canvas.width = size; canvas.height = size;
  canvas.getContext('2d')!.drawImage(bmp, (bmp.width - side) / 2, (bmp.height - side) / 2, side, side, 0, 0, size, size);
  return new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error('image'))), 'image/jpeg', 0.86));
}

// Copia la foto sui propri membri dei viaggi (lo fa anche il database: questa è una garanzia in più).
async function syncMembers(userId: string, url: string | null) {
  await supabase.from('members').update({ avatar_url: url }).eq('user_id', userId);
}

async function removeOld(userId: string, keep?: string) {
  const { data } = await supabase.storage.from(AVATAR_BUCKET).list(userId);
  const old = (data ?? []).map((f) => `${userId}/${f.name}`).filter((p) => p !== keep);
  if (old.length) await supabase.storage.from(AVATAR_BUCKET).remove(old);
}

/** Pulisce le foto profilo: usata prima di eliminare l'account. */
export async function deleteAvatarFiles(userId: string) { await removeOld(userId).catch(() => {}); }

export default function AvatarPicker({ userId, name, url, onChange }: { userId: string; name: string; url?: string | null; onChange: (url: string | null) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function pick(file?: File) {
    if (!file) return;
    setBusy(true);
    try {
      const jpg = await squareJpeg(file);
      const path = `${userId}/avatar-${Date.now()}.jpg`;
      const up = await supabase.storage.from(AVATAR_BUCKET).upload(path, jpg, { contentType: 'image/jpeg', upsert: true });
      if (up.error) throw up.error;
      const publicUrl = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path).data.publicUrl;
      const { error } = await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('id', userId);
      if (error) throw error;
      await syncMembers(userId, publicUrl).catch(() => {});
      await removeOld(userId, path).catch(() => {});
      onChange(publicUrl);
      toast(t('Foto aggiornata'));
    } catch (e) { toast(errorText(e)); }
    finally { setBusy(false); if (input.current) input.current.value = ''; }
  }

  async function clear() {
    setBusy(true);
    try {
      const { error } = await supabase.from('profiles').update({ avatar_url: null }).eq('id', userId);
      if (error) throw error;
      await syncMembers(userId, null).catch(() => {});
      await removeOld(userId).catch(() => {});
      onChange(null);
    } catch (e) { toast(errorText(e)); }
    finally { setBusy(false); }
  }

  return (
    <div className="row" style={{ gap: 16 }}>
      <Avatar m={{ display_name: name || '?', color: 'var(--teal)', role: 'member', avatar_url: url }} size={72} />
      <div className="col" style={{ gap: 8 }}>
        <label className="btn btn-ghost" style={{ position: 'relative', minHeight: 40 }}>
          <Icon name="camera" size={18} />{busy ? t('Carico…') : url ? t('Cambia foto') : t('Aggiungi foto')}
          <input ref={input} type="file" accept="image/*" disabled={busy} style={{ position: 'absolute', inset: 0, opacity: 0 }} onChange={(e) => pick(e.target.files?.[0])} aria-label={t('Foto profilo')} />
        </label>
        {url && <button type="button" className="small" style={{ background: 'none', border: 'none', color: 'var(--orange-dark)', padding: 0, textAlign: 'left', minHeight: 28 }} onClick={clear} disabled={busy}>{t('Rimuovi foto')}</button>}
      </div>
    </div>
  );
}
