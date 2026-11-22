import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Avatar, Icon } from '../../components/ui';
import { EXPENSE_CATEGORIES, money } from '../../lib/format';
import { t } from '../../lib/i18n';
import { useTrip } from '../../lib/TripContext';

/** Dove sono andati i soldi: per categoria, per persona, per giorno e rispetto al budget. */
export default function Stats() {
  const { b } = useTrip();
  const cur = b.trip.currency;
  const s = useMemo(() => {
    const total = b.expenses.reduce((a, e) => a + e.amount_base, 0);
    const byCat = EXPENSE_CATEGORIES.map((c) => ({ ...c, value: b.expenses.filter((e) => e.category === c.id).reduce((a, e) => a + e.amount_base, 0) }))
      .filter((c) => c.value > 0).sort((a, z) => z.value - a.value);
    const people = b.members.map((m) => ({
      m,
      paid: b.expenses.filter((e) => e.paid_by === m.id).reduce((a, e) => a + e.amount_base, 0),
      share: b.shares.filter((x) => x.member_id === m.id).reduce((a, x) => a + x.amount_base, 0),
    })).sort((a, z) => z.share - a.share);
    const days = new Set(b.expenses.map((e) => e.spent_on)).size;
    let tripDays = 0;
    if (b.trip.start_date && b.trip.end_date) tripDays = Math.round((new Date(b.trip.end_date).getTime() - new Date(b.trip.start_date).getTime()) / 86400000) + 1;
    const biggest = [...b.expenses].sort((a, z) => z.amount_base - a.amount_base).slice(0, 3);
    return { total, byCat, people, perDay: total / Math.max(1, tripDays || days), perPerson: total / Math.max(1, b.members.length), biggest };
  }, [b]);
  const maxPerson = Math.max(1, ...s.people.map((p) => Math.max(p.paid, p.share)));
  const budget = b.trip.budget ?? null;

  return (
    <div className="screen no-tabs">
      <header className="row">
        <Link to=".." relative="path" className="icon-btn" aria-label={t('Indietro')}><Icon name="back" /></Link>
        <div className="col"><p className="small muted">{b.trip.name}</p><h1 className="display" style={{ fontSize: 28 }}>{t('Statistiche')}</h1></div>
      </header>

      {!b.expenses.length ? <p className="empty">{t('Le statistiche compaiono dopo la prima spesa.')}</p> : (
        <>
          <section className="stats-grid">
            <div className="card col"><span className="tiny muted">{t('Totale')}</span><span className="display" style={{ fontSize: 22 }}>{money(s.total, cur)}</span></div>
            <div className="card col"><span className="tiny muted">{t('A persona')}</span><span className="display" style={{ fontSize: 22 }}>{money(s.perPerson, cur)}</span></div>
            <div className="card col"><span className="tiny muted">{t('Al giorno')}</span><span className="display" style={{ fontSize: 22 }}>{money(s.perDay, cur)}</span></div>
            <div className="card col"><span className="tiny muted">{t('Budget usato')}</span><span className="display" style={{ fontSize: 22 }}>{budget ? `${Math.round((s.total / budget) * 100)}%` : '—'}</span></div>
          </section>

          <section className="stack">
            <h2 className="eyebrow">{t('Per categoria')}</h2>
            <ul className="list">
              {s.byCat.map((c) => (
                <li key={c.id} className="col" style={{ alignItems: 'stretch', gap: 6, padding: '10px 0' }}>
                  <div className="between small"><span className="strong">{t(c.label)}</span><span>{money(c.value, cur)} · {Math.round((c.value / s.total) * 100)}%</span></div>
                  <div className="bar" aria-hidden="true"><div style={{ width: `${(c.value / s.byCat[0].value) * 100}%`, background: c.fg }} /></div>
                </li>
              ))}
            </ul>
          </section>

          <section className="stack">
            <h2 className="eyebrow">{t('Per persona')}</h2>
            <p className="tiny muted">{t('Barra piena: quanto ha pagato. Barra chiara: la sua quota delle spese.')}</p>
            <ul className="list">
              {s.people.map(({ m, paid, share }) => (
                <li key={m.id} style={{ alignItems: 'flex-start', padding: '10px 0' }}>
                  <Avatar m={m} />
                  <div className="col grow" style={{ gap: 6 }}>
                    <div className="between small"><span className="strong">{m.id === b.me?.id ? `${m.display_name} (${t('tu')})` : m.display_name}</span><span>{money(paid, cur)} / {money(share, cur)}</span></div>
                    <div className="bar" aria-hidden="true"><div style={{ width: `${(paid / maxPerson) * 100}%`, background: 'var(--teal)' }} /></div>
                    <div className="bar" aria-hidden="true"><div style={{ width: `${(share / maxPerson) * 100}%`, background: 'var(--chip)' }} /></div>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <section className="stack">
            <h2 className="eyebrow">{t('Spese più grandi')}</h2>
            <ul className="list">
              {s.biggest.map((e) => <li key={e.id}><span className="grow small">{e.title}</span><span className="small strong">{money(e.amount_base, cur)}</span></li>)}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}
