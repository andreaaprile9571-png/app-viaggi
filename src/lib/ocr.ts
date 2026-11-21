// Lettura dello scontrino sul dispositivo (Tesseract.js): nessuna foto viene inviata a servizi esterni.
export type ReceiptGuess = { total: number | null; date: string | null; merchant: string | null; text: string };

/** Riduce la foto a ~1600 px per velocizzare lettura e caricamento. */
export async function shrinkImage(file: Blob, max = 1600): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  return new Promise((res) => canvas.toBlob((b) => res(b ?? file), 'image/jpeg', 0.85));
}

export async function readReceipt(image: Blob, onProgress?: (p: number) => void): Promise<ReceiptGuess> {
  const { createWorker } = await import('tesseract.js');
  const worker = await createWorker(['ita', 'eng'], 1, {
    logger: (m: { status: string; progress: number }) => { if (m.status === 'recognizing text') onProgress?.(m.progress); },
  });
  const { data } = await worker.recognize(image);
  await worker.terminate();
  return parseReceipt(data.text);
}

const num = (s: string) => {
  const clean = s.replace(/\s/g, '');
  // 1.234,56 · 1,234.56 · 12,50 · 12.50
  const m = clean.match(/(\d{1,3}(?:[.,]\d{3})*|\d+)[.,](\d{2})$/);
  if (!m) return null;
  return Number(m[1].replace(/[.,]/g, '') + '.' + m[2]);
};

export function parseReceipt(text: string): ReceiptGuess {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  let total: number | null = null;
  const totalRe = /(totale|total|importo|tot\.|amount|summe|montant|a pagare|pagato)/i;
  for (const l of lines) {
    if (totalRe.test(l) && !/subtot|iva|vat|tax|resto|change/i.test(l)) {
      const m = l.match(/(\d[\d.,\s]*[.,]\d{2})(?!.*\d[.,]\d{2})/);
      const v = m ? num(m[1]) : null;
      if (v && (!total || v > total)) total = v;
    }
  }
  if (!total) {
    const all = lines.flatMap((l) => [...l.matchAll(/(\d[\d.,]*[.,]\d{2})/g)].map((m) => num(m[1]) ?? 0));
    total = all.length ? Math.max(...all) : null;
  }
  let date: string | null = null;
  const dm = text.match(/(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/);
  if (dm) {
    const y = dm[3].length === 2 ? '20' + dm[3] : dm[3];
    const d = new Date(`${y}-${dm[2].padStart(2, '0')}-${dm[1].padStart(2, '0')}T12:00:00`);
    if (!isNaN(d.getTime()) && d.getFullYear() > 2000) date = d.toISOString().slice(0, 10);
  }
  const merchant = lines.find((l) => /[a-z]{3,}/i.test(l) && !/scontrino|documento|commerciale|p\.?\s?iva|via |tel/i.test(l))?.slice(0, 60) ?? null;
  return { total, date, merchant, text };
}
