// ops-freight.jsx — freight broadcast & tender assignment
const { useState: useStateFR } = React;

function FreightRow({ f, active, onClick }) {
  const { t, zoneById } = useStore();
  const map = { available: ['badge-gray', t('Borrador', 'Draft')], broadcasting: ['badge-brand', t('En difusión', 'Broadcasting')], assigned: ['badge-blue', t('Asignado', 'Assigned')] };
  const [cls, lb] = map[f.status];
  return (
    <button onClick={onClick} style={{ width: '100%', textAlign: 'left', padding: '13px 14px', border: 'none',
      borderBottom: '1px solid var(--line-soft)', borderLeft: '3px solid ' + (active ? 'var(--brand)' : 'transparent'),
      background: active ? 'var(--brand-tint)' : 'transparent' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <span className="mono" style={{ fontSize: 11, color: 'var(--ink-400)' }}>{f.id}</span>
        <span className={'badge ' + cls} style={{ fontSize: 9.5 }}>{f.status === 'broadcasting' && <span className="dot live-dot" />}{lb}</span>
      </div>
      <div style={{ fontWeight: 600, fontSize: 13.5, marginBottom: 4 }}>{f.client}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: 'var(--ink-500)' }}>
        <span>{zoneById(f.pickup)?.es}</span><Icon name="arrowR" size={11} /><span>{zoneById(f.drop)?.es}</span>
        <span style={{ marginLeft: 'auto' }} className="mono">{cop(f.payout)}</span>
      </div>
    </button>
  );
}

function FreightDetail({ f }) {
  const { t, lang, drivers, youDriver, vehicleById, zoneById, broadcastFreight, acceptTender, tierForScore } = useStore();
  const all = youDriver ? [...drivers, youDriver] : drivers;
  // eligible drivers: matching vehicle, ranked by score (priority for outstanding)
  const eligible = all.filter(d => d.vehicle === f.vehicle).sort((a, b) => b.score - a.score);
  const assigned = f.accepted ? all.find(d => d.id === f.accepted) : null;

  const Spec = ({ icon, label, value }) => (
    <div style={{ background: 'var(--surface-2)', borderRadius: 10, padding: '11px 13px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--ink-400)', marginBottom: 4 }}>
        <Icon name={icon} size={14} /><span className="mono" style={{ fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '.05em' }}>{label}</span>
      </div>
      <div style={{ fontSize: 14, fontWeight: 600 }}>{value}</div>
    </div>
  );

  return (
    <div className="scroll" style={{ flex: 1, overflowY: 'auto', background: 'var(--paper)', padding: 24 }}>
      <div className="card" style={{ padding: 20, marginBottom: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span className="mono" style={{ fontSize: 12, color: 'var(--ink-400)' }}>{f.id}</span>
              {f.priority && <span className="badge badge-amber">{t('Prioritario', 'Priority')}</span>}
            </div>
            <h2 className="display" style={{ fontSize: 22, margin: 0 }}>{f.client}</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginTop: 8 }}>
              <span style={{ fontWeight: 600, fontSize: 14 }}>{zoneById(f.pickup)?.es}</span>
              <span style={{ flex: '0 0 40px', height: 1, borderTop: '1.5px dashed var(--line)' }} />
              <Icon name="pin" size={15} style={{ color: 'var(--brand-600)' }} />
              <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--brand-ink)' }}>{zoneById(f.drop)?.es}</span>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div className="display" style={{ fontSize: 28, fontWeight: 600, color: 'var(--brand-ink)' }}>{cop(f.payout)}</div>
            <div className="mono" style={{ fontSize: 11, color: 'var(--ink-400)' }}>COP · {t('pago al conductor', 'driver payout')}</div>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }}>
          <Spec icon="route" label={t('Distancia', 'Distance')} value={f.distance} />
          <Spec icon="clock" label={t('Ventana', 'Window')} value={f.window} />
          <Spec icon="freight" label={t('Peso', 'Weight')} value={f.weight} />
          <Spec icon={vehicleIcon(f.vehicle)} label={t('Vehículo', 'Vehicle')} value={lang === 'es' ? vehicleById(f.vehicle)?.es : vehicleById(f.vehicle)?.en} />
        </div>
      </div>

      {/* assigned state */}
      {f.status === 'assigned' && assigned && (
        <div className="card fade-up" style={{ padding: 18, marginBottom: 18, borderColor: 'var(--blue)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <VehicleGlyph id={assigned.vehicle} size={46} tone="brand" />
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontWeight: 600, fontSize: 15 }}>{assigned.name}</span>
                <TierBadge score={assigned.score} small />
              </div>
              <div className="mono" style={{ fontSize: 12, color: 'var(--ink-500)', marginTop: 2 }}>{assigned.plate} · {t('aceptó el flete', 'accepted tender')}</div>
            </div>
            <span className="badge badge-blue"><span className="dot live-dot" />{t('En camino al origen', 'En route to pickup')}</span>
          </div>
        </div>
      )}

      {/* broadcast panel */}
      <div className="card" style={{ padding: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <h3 className="display" style={{ fontSize: 15, margin: 0 }}>{t('Conductores elegibles', 'Eligible drivers')}</h3>
          <span style={{ fontSize: 12.5, color: 'var(--ink-500)' }}>{eligible.length} {t('coinciden', 'match')}</span>
        </div>
        <p style={{ fontSize: 12, color: 'var(--ink-500)', margin: '0 0 14px' }}>
          {t('Los conductores Élite y Preferente reciben prioridad en la difusión.', 'Elite and Preferred drivers get broadcast priority.')}
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {eligible.slice(0, 5).map((d, i) => {
            const tier = tierForScore(d.score);
            const priority = tier === 'elite' || tier === 'preferente';
            const isAssigned = f.accepted === d.id;
            return (
              <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '9px 11px', borderRadius: 10,
                background: isAssigned ? 'var(--blue-tint)' : priority && f.status === 'broadcasting' ? 'var(--brand-tint)' : 'var(--surface-2)',
                border: '1px solid ' + (isAssigned ? 'var(--blue)' : 'transparent') }}>
                <span className="mono" style={{ fontSize: 11, color: 'var(--ink-400)', width: 16 }}>{i + 1}</span>
                <VehicleGlyph id={d.vehicle} size={34} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{d.name}{d.isYou ? ' · ' + t('tú', 'you') : ''}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 1 }}>
                    <TierBadge score={d.score} small />
                    {priority && <span className="mono" style={{ fontSize: 10, color: 'var(--brand-ink)' }}>{t('+15 s antes', '+15 s early')}</span>}
                  </div>
                </div>
                {isAssigned
                  ? <span className="badge badge-blue"><Icon name="check" size={11} stroke={3} />{t('Aceptó', 'Accepted')}</span>
                  : f.status === 'broadcasting'
                    ? <span className="badge badge-gray"><span className="dot live-dot" />{t('Notificado', 'Notified')}</span>
                    : <span className="mono" style={{ fontSize: 12, color: 'var(--ink-400)' }}>{d.score}</span>}
              </div>
            );
          })}
        </div>
      </div>

      {/* action bar */}
      <div style={{ display: 'flex', gap: 12, marginTop: 18, alignItems: 'center' }}>
        {f.status === 'available' && (
          <button className="btn btn-primary btn-lg" style={{ flex: 1 }} onClick={() => broadcastFreight(f.id)}>
            <Icon name="signal" size={18} />{t('Difundir a conductores', 'Broadcast to drivers')}
          </button>
        )}
        {f.status === 'broadcasting' && (<>
          <span className="badge badge-brand" style={{ fontSize: 12 }}><span className="dot live-dot" />{t('Difundiendo · esperando aceptación', 'Broadcasting · awaiting acceptance')}</span>
          <div style={{ flex: 1 }} />
          {eligible[0] && <button className="btn btn-ghost" onClick={() => acceptTender(f.id, eligible[0].id)}>
            {t('Simular aceptación', 'Simulate acceptance')}
          </button>}
        </>)}
        {f.status === 'assigned' && (
          <div style={{ textAlign: 'center', width: '100%', fontSize: 13, color: 'var(--ink-500)' }}>
            <Icon name="checkCircle" size={16} style={{ color: 'var(--brand-600)', verticalAlign: '-3px' }} /> {t('Flete asignado y en seguimiento en el mapa', 'Tender assigned & tracked on the map')}
          </div>
        )}
      </div>
    </div>
  );
}

function OpsFreight() {
  const { t, freight } = useStore();
  const [selId, setSelId] = useStateFR(freight[0]?.id);
  const sel = freight.find(f => f.id === selId) || freight[0];
  return (
    <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
      <div style={{ width: 280, borderRight: '1px solid var(--line)', background: 'var(--surface)', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: 600, fontSize: 14 }}>{t('Fletes', 'Freight')}</span>
          <button className="btn btn-ghost" style={{ padding: '6px 10px', fontSize: 13 }}><Icon name="plus" size={15} />{t('Nuevo', 'New')}</button>
        </div>
        <div className="scroll" style={{ flex: 1, overflowY: 'auto' }}>
          {freight.map(f => <FreightRow key={f.id} f={f} active={f.id === sel?.id} onClick={() => setSelId(f.id)} />)}
        </div>
      </div>
      {sel && <FreightDetail key={sel.id} f={sel} />}
    </div>
  );
}

Object.assign(window, { OpsFreight });
