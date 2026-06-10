// ops-drivers.jsx — driver scoring & priority tiers
const { useState: useStateDR } = React;

function ScoreBar({ score }) {
  const tier = window.tierForScore(score);
  const c = { elite: 'var(--brand)', preferente: 'var(--blue)', estandar: 'var(--ink-400)', nuevo: 'var(--amber)' }[tier];
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
      <div style={{ width: 60, height: 6, borderRadius: 999, background: 'var(--line)', overflow: 'hidden' }}>
        <span style={{ display: 'block', height: '100%', width: score + '%', background: c, borderRadius: 999 }} />
      </div>
      <span className="mono" style={{ fontSize: 13, fontWeight: 600, width: 22 }}>{score}</span>
    </div>
  );
}

function OpsDrivers() {
  const { t, lang, drivers, youDriver, vehicleById, zoneById, tierForScore, TIERS } = useStore();
  const all = (youDriver ? [...drivers, youDriver] : drivers).slice().sort((a, b) => b.score - a.score);
  const [filter, setFilter] = useStateDR('all');
  const filtered = filter === 'all' ? all : all.filter(d => tierForScore(d.score) === filter);
  const tabs = [['all', t('Todos', 'All')], ['elite', TIERS.elite[lang === 'es' ? 'es' : 'en']], ['preferente', TIERS.preferente[lang === 'es' ? 'es' : 'en']], ['estandar', TIERS.estandar[lang === 'es' ? 'es' : 'en']], ['nuevo', TIERS.nuevo[lang === 'es' ? 'es' : 'en']]];

  const Th = ({ children, w, right }) => (
    <th style={{ textAlign: right ? 'right' : 'left', padding: '0 14px 10px', fontSize: 11, fontWeight: 600,
      color: 'var(--ink-500)', textTransform: 'uppercase', letterSpacing: '.05em', width: w, fontFamily: 'var(--font-mono)' }}>{children}</th>
  );
  const Td = ({ children, right }) => (
    <td style={{ padding: '12px 14px', borderTop: '1px solid var(--line-soft)', textAlign: right ? 'right' : 'left', fontSize: 13.5 }}>{children}</td>
  );

  return (
    <div className="scroll" style={{ flex: 1, overflowY: 'auto', background: 'var(--paper)', padding: 24 }}>
      {/* scoring legend */}
      <div className="card" style={{ padding: 18, marginBottom: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
          <span style={{ color: 'var(--ink-700)' }}><Icon name="star" size={18} /></span>
          <h3 className="display" style={{ fontSize: 15, margin: 0 }}>{t('Modelo de puntaje y prioridad', 'Scoring & priority model')}</h3>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
          {Object.entries(TIERS).map(([k, v]) => (
            <div key={k} style={{ padding: 13, borderRadius: 11, background: v.bg, border: '1px solid var(--line)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                {k === 'elite' && <span style={{ color: v.color }}><Icon name="star" size={14} /></span>}
                <span style={{ fontWeight: 700, fontSize: 14, color: v.color }}>{lang === 'es' ? v.es : v.en}</span>
              </div>
              <div className="mono" style={{ fontSize: 11, color: 'var(--ink-500)' }}>{v.min}+ {t('pts', 'pts')}</div>
              <div style={{ fontSize: 11.5, color: 'var(--ink-600)', marginTop: 6, lineHeight: 1.35 }}>
                {k === 'elite' ? t('Prioridad máxima · fletes 15 s antes', 'Top priority · freight 15 s early')
                  : k === 'preferente' ? t('Prioridad alta en difusión', 'High broadcast priority')
                  : k === 'estandar' ? t('Difusión estándar', 'Standard broadcast')
                  : t('Volumen limitado al inicio', 'Limited initial volume')}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* filters */}
      <div style={{ display: 'flex', gap: 7, marginBottom: 14 }}>
        {tabs.map(([k, lb]) => (
          <button key={k} onClick={() => setFilter(k)} style={{ padding: '7px 14px', borderRadius: 999, fontSize: 13, fontWeight: 600,
            border: '1px solid ' + (filter === k ? 'var(--ink-900)' : 'var(--line)'),
            background: filter === k ? 'var(--ink-900)' : 'var(--surface)', color: filter === k ? '#fff' : 'var(--ink-600)' }}>{lb}</button>
        ))}
      </div>

      {/* table */}
      <div className="card" style={{ padding: '14px 4px 6px', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr>
            <Th>{t('Conductor', 'Driver')}</Th>
            <Th>{t('Nivel', 'Tier')}</Th>
            <Th>{t('Puntaje', 'Score')}</Th>
            <Th right>{t('Entregas', 'Deliveries')}</Th>
            <Th right>{t('Aceptación', 'Accept')}</Th>
            <Th right>{t('A tiempo', 'On-time')}</Th>
            <Th>{t('Estado', 'Status')}</Th>
          </tr></thead>
          <tbody>
            {filtered.map(d => (
              <tr key={d.id} style={{ background: d.isYou ? 'var(--brand-tint)' : 'transparent' }}>
                <Td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                    <VehicleGlyph id={d.vehicle} size={36} />
                    <div>
                      <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>{d.name}{d.isYou && <span className="badge badge-ink" style={{ fontSize: 9 }}>{t('TÚ', 'YOU')}</span>}</div>
                      <div className="mono" style={{ fontSize: 11, color: 'var(--ink-400)' }}>{d.plate} · {zoneById(d.zone)?.es}</div>
                    </div>
                  </div>
                </Td>
                <Td><TierBadge score={d.score} small /></Td>
                <Td><ScoreBar score={d.score} /></Td>
                <Td right><span className="mono" style={{ fontWeight: 600 }}>{d.deliveries.toLocaleString('es-CO')}</span></Td>
                <Td right><span className="mono">{d.accept}%</span></Td>
                <Td right><span className="mono" style={{ color: d.onTime >= 95 ? 'var(--brand-ink)' : 'var(--ink-700)' }}>{d.onTime}%</span></Td>
                <Td><StatusPill status={d.status} /></Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

Object.assign(window, { OpsDrivers });
