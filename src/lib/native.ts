import { Capacitor } from '@capacitor/core';

export const isNative = Capacitor.isNativePlatform();

function toBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1] ?? '');
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

const safeName = (name: string) => name.replace(/[^\w.\- ]+/g, '_').slice(0, 80) || 'documento';

/**
 * Passa il file a un'altra app (lettore PDF, Wallet, Drive, WhatsApp…).
 * Android: lo salva nella cache e apre il pannello di condivisione.
 * iPhone/web: usa la condivisione del sistema se c'è, altrimenti scarica il file.
 */
export async function openWithApp(blob: Blob, name: string) {
  const fileName = safeName(name);
  if (isNative) {
    const [{ Filesystem, Directory }, { Share }] = await Promise.all([import('@capacitor/filesystem'), import('@capacitor/share')]);
    const res = await Filesystem.writeFile({ path: fileName, data: await toBase64(blob), directory: Directory.Cache });
    await Share.share({ title: name, files: [res.uri], dialogTitle: name });
    return;
  }
  const file = new File([blob], fileName, { type: blob.type || 'application/octet-stream' });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav.share && nav.canShare?.({ files: [file] })) {
    try { await nav.share({ files: [file], title: name }); return; } catch (e) { if ((e as Error).name === 'AbortError') return; }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = fileName; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
