// ops-map.jsx — realtime GPS tracking
const { useState: useStateMP } = React;

function OpsMap() {
  const { t, lang, drivers, youDriver, vehicleById, zoneById } = useStore();
  const all = youDriver ? [...drivers, youDriver] : drivers;
  const [selId, setSelId] = useStateMP(null);
  const sel = all.find(d => d.id === selId);
  const active = all.filter(d => d.status !== 'idle');

  return (
    <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
      {/* map */}
      <div style={{ flex: 1, position: 'relative', minWidth: 0 }}>
        <MapCanvas drivers={all} showZones activeId={selId} onPick={d => setSelId(d.id)} />
        {/* overlay legend */}
        <div style={{ position: 'absolute', top: 16, left: 16, display: 'flex', gap: 8 }}>
          <span className="badge" style={{ background: '#fff', boxShadow: 'var(--shadow)', color: 'var(--ink-700)' }}>
            <span className="dot live-dot" style={{ background: 'var(--brand)' }} />{active.length} {t('en movimiento', 'moving')}
          </span>
          <span className="badge" style={{ background: '#fff', boxShadow: 'var(--shadow)', color: 'var(--ink-700)' }}>
            {all.length - active.length} {t('disponibles', 'idle')}
          </span>
        </div>
        <div style={{ position: 'absolute', bottom: 16, left: 16, display: 'flex', gap: 14, background: '#fff',
          padding: '9px 14px', borderRadius: 10, boxShadow: 'var(--shadow)' }}>
          {[['var(--brand-600)', t('Entregando', 'Delivering')], ['var(--blue)', t('En ruta', 'En route')], ['var(--ink-400)', t('Disponible', 'Idle')]].map(([c, l]) => (
            <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 9, height: 9, borderRadius: 999, background: c }} />
              <span style={{ fontSize: 12, color: 'var(--ink-600)' }}>{l}</span>
            </div>
          ))}
        </div>
        {/* selected driver card */}
        {sel && (
          <div className="fade-up" style={{ position: 'absolute', top: 16, right: 16, width: 268, background: 'var(--surface)',
            borderRadius: 14, boxShadow: 'var(--shadow-lg)', overflow: 'hidden' }}>
            <div style={{ padding: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <div style={{ display: 'flex', gap: 11, alignItems: 'center' }}>
                  <VehicleGlyph id={sel.vehicle} size={42} tone="brand" />
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14.5 }}>{sel.name}</div>
                    <div className="mono" style={{ fontSize: 11, color: 'var(--ink-400)' }}>{sel.plate}</div>
                  </div>
                </div>
                <button onClick={() => setSelId(null)} style={{ border: 'none', background: 'transparent', color: 'var(--ink-400)' }}><Icon name="x" size={16} /></button>
              </div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                <StatusPill status={sel.status} />
                <TierBadge score={sel.score} small />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {[[t('Zona', 'Zone'), zoneById(sel.zone)?.es], [t('ETA', 'ETA'), sel.status !== 'idle' ? Math.max(2, 16 - Math.round((sel.prog||0)*14)) + ' min' : '—'],
                  [t('Entregas', 'Deliveries'), sel.deliveries], [t('A tiempo', 'On-time'), sel.onTime + '%']].map(([a, b]) => (
                  <div key={a} style={{ background: 'var(--surface-2)', borderRadius: 9, padding: '8px 10px' }}>
                    <div className="mono" style={{ fontSize: 9.5, color: 'var(--ink-400)', textTransform: 'uppercase', letterSpacing: '.05em' }}>{a}</div>
                    <div style={{ fontSize: 14, fontWeight: 600, marginTop: 2 }}>{b}</div>
                  </div>
                ))}
              </div>
            </div>
            {sel.status !== 'idle' && (
              <div style={{ padding: '11px 16px', background: 'var(--ink-900)', color: '#fff', display: 'flex', alignItems: 'center', gap: 9 }}>
                <span className="dot live-dot" style={{ width: 7, height: 7, borderRadius: 999, background: 'var(--brand)' }} />
                <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)' }}>GPS {sel.pos.x.toFixed(3)}, {sel.pos.y.toFixed(3)}</span>
              </div>
            )}
          </div>
        )}
      </div>
      {/* driver list */}
      <div style={{ width: 260, borderLeft: '1px solid var(--line)', background: 'var(--surface)', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: 600, fontSize: 14 }}>{t('Flota activa', 'Active fleet')}</span>
          <span className="badge badge-brand"><span className="dot live-dot" />{all.length}</span>
        </div>
        <div className="scroll" style={{ flex: 1, overflowY: 'auto' }}>
          {all.slice().sort((a, b) => (a.status === 'idle') - (b.status === 'idle')).map(d => (
            <button key={d.id} onClick={() => setSelId(d.id)} style={{ width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 10,
              padding: '11px 14px', border: 'none', borderBottom: '1px solid var(--line-soft)',
              background: selId === d.id ? 'var(--brand-tint)' : 'transparent' }}>
              <div style={{ position: 'relative' }}>
                <VehicleGlyph id={d.vehicle} size={36} />
                <span style={{ position: 'absolute', bottom: -1, right: -1, width: 10, height: 10, borderRadius: 999,
                  background: STATUS_COLOR[d.status], border: '2px solid var(--surface)' }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.name}{d.isYou ? ' ·' : ''}{d.isYou ? <span style={{ color: 'var(--brand-ink)' }}> {t('tú','you')}</span> : ''}</div>
                <div className="mono" style={{ fontSize: 10.5, color: 'var(--ink-400)' }}>{d.plate} · {zoneById(d.zone)?.es}</div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { OpsMap });
