import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { DOC_ICON, Icon, OfflineBanner, Sheet, TabBar } from '../../components/ui';
import { dateShort, DOC_CATEGORIES } from '../../lib/format';
import { t } from '../../lib/i18n';
import { useTrip } from '../../lib/TripContext';
import type { DocCategory } from '../../lib/supabase';
import DocumentForm from './DocumentForm';

export default function Documents() {
  const { b, stale, queued } = useTrip();
  const [mine, setMine] = useState(false);
  const [open, setOpen] = useState<DocCategory | null>(null);
  const [adding, setAdding] = useState(false);

  const visible = useMemo(() => {
    if (!mine) return b.documents;
    const ids = new Set(b.assignees.filter((a) => a.member_id === b.me?.id).map((a) => a.document_id));
    return b.documents.filter((d) => ids.has(d.id) || d.uploaded_by === b.me?.id);
  }, [b, mine]);

  return (
    <div className="screen">
      <header className="col" style={{ gap: 2 }}>
        <p className="small muted">{b.trip.name}</p>
        <h1 className="display" style={{ fontSize: 30 }}>{t('Documenti')}</h1>
      </header>
      <div className="segmented" role="group" aria-label={t("Filtro documenti")}>
        <button aria-pressed={!mine} onClick={() => setMine(false)}>{t('Tutti')}</button>
        <button aria-pressed={mine} onClick={() => setMine(true)}>{t('Solo i miei')}</button>
      </div>
      <OfflineBanner stale={stale} queued={queued} />
      <div className="banner teal"><Icon name="cloud-check" size={18} /><span>{t("I documenti dei prossimi 7 giorni e quelli assegnati a te si salvano sul telefono.")}</span></div>

      <ul className="stack" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {DOC_CATEGORIES.map((c) => {
          const docs = visible.filter((d) => d.category === c.id);
          if (!docs.length && c.id === 'altro') return null;
          const first = docs.find((d) => d.starts_at && new Date(d.starts_at) > new Date()) ?? docs[0];
          return (
            <li key={c.id}>
              <button className="linkcard" onClick={() => setOpen(c.id)}>
                <span className="icon-tile" style={{ background: c.bg, color: c.fg }}><Icon name={DOC_ICON[c.id]} /></span>
                <span className="col grow">
                  <span className="strong">{t(c.label)}</span>
                  <span className="small muted ellipsis">
                    {c.id === 'personali' ? <><Icon name="lock" size={12} /> {t("Puoi renderli privati")}</> : first ? `${first.title}${first.starts_at ? ' · ' + dateShort(first.starts_at) : ''}` : t('Nessun documento')}
                  </span>
                </span>
                <span className="strong muted">{docs.length}</span>
              </button>
            </li>
          );
        })}
      </ul>

      <button className="fab teal" onClick={() => setAdding(true)}><Icon name="plus" size={20} />{t('Aggiungi')}</button>

      {open && (() => {
        const c = DOC_CATEGORIES.find((x) => x.id === open)!;
        const docs = visible.filter((d) => d.category === open);
        return (
          <Sheet title={t(c.label)} onClose={() => setOpen(null)}>
            {docs.length ? (
              <ul className="list" style={{ padding: 0 }}>
                {docs.map((d) => (
                  <li key={d.id} style={{ padding: 0 }}>
                    <Link to={d.id} className="linkcard" style={{ padding: '12px 0' }}>
                      <span className="col grow"><span className="strong">{d.title}</span>
                        <span className="small muted">{[d.starts_at && dateShort(d.starts_at), d.ref_code, d.visibility === 'private' ? 'privato' : null].filter(Boolean).join(' · ')}</span></span>
                      <Icon name="chevron" size={18} className="muted" />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : <p className="empty">{t('Nessun documento in questa categoria.')}</p>}
            <button className="btn btn-teal btn-block" onClick={() => { setAdding(true); }}><Icon name="plus" size={18} />{t('Aggiungi')}</button>
          </Sheet>
        );
      })()}

      {adding && <Sheet title={t('Nuovo documento')} onClose={() => setAdding(false)}><DocumentForm category={open ?? 'voli'} onDone={() => { setAdding(false); setOpen(null); }} /></Sheet>}
      <TabBar />
    </div>
  );
}
