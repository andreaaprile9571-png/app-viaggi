import { useEffect, useRef, useState } from 'react';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import workerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url';
import { t } from '../lib/i18n';

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

/**
 * Mostra un PDF disegnando ogni pagina su un canvas.
 * Serve perché la WebView di Android (e in parte Safari su iPhone) non visualizza i PDF in un iframe.
 */
export default function PdfViewer({ blob }: { blob: Blob }) {
  const box = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [pages, setPages] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let task: ReturnType<typeof pdfjs.getDocument> | null = null;
    (async () => {
      try {
        const data = new Uint8Array(await blob.arrayBuffer());
        task = pdfjs.getDocument({ data });
        const doc = await task.promise;
        if (cancelled || !box.current) return;
        setPages(doc.numPages);
        box.current.innerHTML = '';
        const width = box.current.clientWidth || 340;
        const ratio = Math.min(window.devicePixelRatio || 1, 2.5);
        for (let n = 1; n <= doc.numPages; n++) {
          const page = await doc.getPage(n);
          if (cancelled || !box.current) return;
          const base = page.getViewport({ scale: 1 });
          const viewport = page.getViewport({ scale: (width / base.width) * ratio });
          const canvas = document.createElement('canvas');
          canvas.width = Math.floor(viewport.width);
          canvas.height = Math.floor(viewport.height);
          canvas.style.width = '100%';
          canvas.setAttribute('role', 'img');
          canvas.setAttribute('aria-label', `${t('Pagina')} ${n}`);
          box.current.appendChild(canvas);
          const ctx = canvas.getContext('2d')!;
          await page.render({ canvas, canvasContext: ctx, viewport } as Parameters<typeof page.render>[0]).promise;
          if (n === 1) setState('ready');
        }
      } catch {
        if (!cancelled) setState('error');
      }
    })();
    return () => { cancelled = true; task?.destroy(); };
  }, [blob]);

  return (
    <div className="pdf-viewer">
      {state === 'loading' && <p className="small muted">{t('Apertura del documento…')}</p>}
      {state === 'error' && <p className="error">{t('Impossibile mostrare il PDF qui: usa «Apri con…».')}</p>}
      <div ref={box} className="pdf-pages" aria-label={pages ? `${pages} ${t('pagine')}` : undefined} />
    </div>
  );
}
