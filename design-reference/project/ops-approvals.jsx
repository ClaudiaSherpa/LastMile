// ops-approvals.jsx — security approval queue + applicant review
const { useState: useStateAP, useEffect: useEffectAP } = React;

const DOC_STATUS = {
  ok:      { es: 'Validado', en: 'Valid',    cls: 'badge-brand', icon: 'checkCircle' },
  review:  { es: 'Revisar',  en: 'Review',   cls: 'badge-amber', icon: 'alert' },
  expired: { es: 'Vencido',  en: 'Expired',  cls: 'badge-red',   icon: 'xCircle' },
};
const SEC_STATUS = {
  pass:    { es: 'Aprobado',  en: 'Pass',     cls: 'badge-brand', icon: 'checkCircle' },
  pending: { es: 'Procesando',en: 'Pending',  cls: 'badge-gray',  icon: 'clock' },
  flag:    { es: 'Alerta',    en: 'Flagged',  cls: 'badge-red',   icon: 'alert' },
  review:  { es: 'Revisar',   en: 'Review',   cls: 'badge-amber', icon: 'alert' },
};

function QueueRow({ app, active, onClick }) {
  const { t, lang, vehicleById } = useStore();
  const flags = Object.values(app.docs).filter(s => s !== 'ok').length + Object.values(app.security).filter(s => s === 'flag' || s === 'review').length;
  return (
    <button onClick={onClick} style={{ width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 12,
      padding: '13px 14px', border: 'none', borderBottom: '1px solid var(--line-soft)',
      background: active ? 'var(--brand-tint)' : 'transparent', borderLeft: '3px solid ' + (active ? 'var(--brand)' : 'transparent'),
      transition: 'background .12s' }}>
      <VehicleGlyph id={app.vehicle} size={40} tone={active ? 'brand' : 'ink'} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <span style={{ fontWeight: 600, fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{app.name}</span>
          {app.you && <span className="badge badge-ink" style={{ fontSize: 9 }}>{t('TÚ', 'YOU')}</span>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
          <span className="mono" style={{ fontSize: 11, color: 'var(--ink-400)' }}>{app.id}</span>
          <span style={{ color: 'var(--ink-400)' }}>·</span>
          <span style={{ fontSize: 11.5, color: 'var(--ink-500)' }}>{lang === 'es' ? app.submitted : app.submittedEn}</span>
        </div>
      </div>
      {flags > 0
        ? <span className="badge badge-amber" style={{ fontSize: 10 }}>{flags} {t('rev.', 'flag')}</span>
        : <span className="badge badge-brand" style={{ fontSize: 10 }}><Icon name="check" size={11} stroke={3} /></span>}
    </button>
  );
}

function DocRow({ label, status }) {
  const { lang } = useStore();
  const s = DOC_STATUS[status];
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 0', borderBottom: '1px solid var(--line-soft)' }}>
      <div style={{ width: 46, height: 34, borderRadius: 6, background: 'repeating-linear-gradient(45deg, var(--surface-2), var(--surface-2) 5px, var(--line-soft) 5px, var(--line-soft) 10px)',
        border: '1px solid var(--line)', display: 'grid', placeItems: 'center', color: 'var(--ink-400)', flexShrink: 0 }}>
        <Icon name="doc" size={15} />
      </div>
      <span style={{ flex: 1, fontSize: 13.5, fontWeight: 500 }}>{label}</span>
      <span className={'badge ' + s.cls}><Icon name={s.icon} size={11} />{lang === 'es' ? s.es : s.en}</span>
    </div>
  );
}

function ApplicantDetail({ app }) {
  const { t, lang, vehicleById, zoneById, decideApplication, tierForScore, TIERS } = useStore();
  const recScore = useMemoAP(app);
  if (app.status !== 'in_review') {
    return (
      <div style={{ flex: 1, display: 'grid', placeItems: 'center', background: 'var(--paper)' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 64, height: 64, borderRadius: 999, margin: '0 auto 14px', display: 'grid', placeItems: 'center',
            background: app.status === 'approved' ? 'var(--brand-tint)' : 'var(--red-tint)', color: app.status === 'approved' ? 'var(--brand-ink)' : 'var(--red-ink)' }}>
            <Icon name={app.status === 'approved' ? 'checkCircle' : 'xCircle'} size={34} />
          </div>
          <div className="display" style={{ fontSize: 19 }}>{app.status === 'approved' ? t('Conductor aprobado', 'Driver approved') : t('Solicitud rechazada', 'Application rejected')}</div>
          <div style={{ fontSize: 13, color: 'var(--ink-500)', marginTop: 4 }}>{app.name} · {app.id}</div>
          {app.status === 'approved' && <div style={{ marginTop: 12 }}><TierBadge score={app.score} /></div>}
        </div>
      </div>
    );
  }
  const hasFlag = Object.values(app.security).includes('flag');
  return (
    <div className="scroll" style={{ flex: 1, overflowY: 'auto', background: 'var(--paper)' }}>
      {/* header */}
      <div style={{ padding: '20px 24px', background: 'var(--surface)', borderBottom: '1px solid var(--line)' }}>
        <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
          <VehicleGlyph id={app.vehicle} size={54} tone="brand" />
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
              <h2 className="display" style={{ fontSize: 21, margin: 0 }}>{app.name}</h2>
              {app.you && <span className="badge badge-ink">{t('TÚ', 'YOU')}</span>}
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 4, color: 'var(--ink-500)', fontSize: 13 }}>
              <span className="mono">{app.id}</span>
              <span>{lang === 'es' ? vehicleById(app.vehicle)?.es : vehicleById(app.vehicle)?.en}</span>
              <span className="mono">{app.plate}</span>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div className="eyebrow">{t('Puntaje sugerido', 'Suggested score')}</div>
            <div className="display" style={{ fontSize: 30, fontWeight: 600, color: 'var(--brand-ink)' }}>{recScore}</div>
            <TierBadge score={recScore} small />
          </div>
        </div>
      </div>

      <div style={{ padding: 24, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
        {/* security checks */}
        <div className="card" style={{ padding: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <span style={{ color: 'var(--ink-700)' }}><Icon name="shield" size={18} /></span>
            <h3 className="display" style={{ fontSize: 15, margin: 0 }}>{t('Verificación de seguridad', 'Security verification')}</h3>
          </div>
          <p style={{ fontSize: 12, color: 'var(--ink-500)', margin: '0 0 8px' }}>{t('Obligatoria antes de asignar volumen', 'Required before assigning volume')}</p>
          {[['identity', t('Identidad (cédula + selfie)', 'Identity (ID + selfie)')],
            ['criminal', t('Antecedentes judiciales', 'Criminal background')],
            ['sanctions', t('Listas restrictivas / OFAC', 'Sanction lists / OFAC')],
            ['vehicle', t('Matrícula y propiedad', 'Registration & ownership')]].map(([k, lb]) => {
            const s = SEC_STATUS[app.security[k]];
            return (
              <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: '1px solid var(--line-soft)' }}>
                <span style={{ color: s.cls === 'badge-brand' ? 'var(--brand-600)' : s.cls === 'badge-red' ? 'var(--red)' : 'var(--ink-400)' }}><Icon name={s.icon} size={18} /></span>
                <span style={{ flex: 1, fontSize: 13.5, fontWeight: 500 }}>{lb}</span>
                <span className={'badge ' + s.cls}>{lang === 'es' ? s.es : s.en}</span>
              </div>
            );
          })}
        </div>

        {/* documents */}
        <div className="card" style={{ padding: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <span style={{ color: 'var(--ink-700)' }}><Icon name="doc" size={18} /></span>
            <h3 className="display" style={{ fontSize: 15, margin: 0 }}>{t('Documentos', 'Documents')}</h3>
          </div>
          <DocRow label={t('Licencia de conducción', "Driver's license")} status={app.docs.license} />
          <DocRow label="SOAT" status={app.docs.soat} />
          <DocRow label={t('Póliza todo riesgo', 'All-risk policy')} status={app.docs.insurance} />
          <DocRow label={t('Tarjeta de propiedad', 'Vehicle registration')} status={app.docs.property} />
          <DocRow label={t('Cédula de ciudadanía', 'National ID')} status={app.docs.id} />
        </div>

        {/* zones + availability */}
        <div className="card" style={{ padding: 18, gridColumn: '1 / -1' }}>
          <h3 className="display" style={{ fontSize: 15, margin: '0 0 12px' }}>{t('Zonas de operación', 'Operating zones')}</h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {app.zones.map(z => <span key={z} className="badge badge-gray" style={{ fontSize: 12 }}><Icon name="pin" size={12} />{zoneById(z)?.es}</span>)}
          </div>
        </div>
      </div>

      {/* decision bar */}
      <div style={{ position: 'sticky', bottom: 0, background: 'var(--surface)', borderTop: '1px solid var(--line)',
        padding: '14px 24px', display: 'flex', alignItems: 'center', gap: 12 }}>
        {hasFlag
          ? <span className="badge badge-red"><Icon name="alert" size={12} />{t('Alerta de seguridad detectada', 'Security flag detected')}</span>
          : <span className="badge badge-brand"><Icon name="check" size={12} stroke={3} />{t('Sin alertas críticas', 'No critical flags')}</span>}
        <div style={{ flex: 1 }} />
        <button className="btn btn-danger" onClick={() => decideApplication(app.id, 'rejected')}>
          <Icon name="x" size={16} />{t('Rechazar', 'Reject')}
        </button>
        <button className="btn btn-primary btn-lg" onClick={() => decideApplication(app.id, 'approved', recScore)}>
          <Icon name="shield" size={17} />{t('Aprobar y activar', 'Approve & activate')}
        </button>
      </div>
    </div>
  );
}

function useMemoAP(app) {
  // recommended score from doc/security health
  let score = 96;
  Object.values(app.docs).forEach(s => { if (s === 'review') score -= 6; if (s === 'expired') score -= 14; });
  Object.values(app.security).forEach(s => { if (s === 'review') score -= 5; if (s === 'flag') score -= 18; if (s === 'pending') score -= 2; });
  return Math.max(48, score);
}

function OpsApprovals() {
  const { t, applications } = useStore();
  const [selId, setSelId] = useStateAP(applications[0]?.id);
  const queue = applications;
  const sel = queue.find(a => a.id === selId) || queue[0];
  const pending = queue.filter(a => a.status === 'in_review').length;

  // keep selection valid; prefer a you-application when it arrives
  useEffectAP(() => {
    const you = queue.find(a => a.you && a.status === 'in_review');
    if (you && !queue.find(a => a.id === selId)) setSelId(you.id);
    if (!queue.find(a => a.id === selId)) setSelId(queue[0]?.id);
  }, [queue.length]);

  return (
    <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
      <div style={{ width: 300, borderRight: '1px solid var(--line)', background: 'var(--surface)', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontWeight: 600, fontSize: 14 }}>{t('Cola de revisión', 'Review queue')}</span>
          <span className="badge badge-amber">{pending} {t('pendientes', 'pending')}</span>
        </div>
        <div className="scroll" style={{ flex: 1, overflowY: 'auto' }}>
          {queue.map(a => <QueueRow key={a.id} app={a} active={a.id === sel?.id} onClick={() => setSelId(a.id)} />)}
        </div>
      </div>
      {sel && <ApplicantDetail key={sel.id} app={sel} />}
    </div>
  );
}

Object.assign(window, { OpsApprovals });
