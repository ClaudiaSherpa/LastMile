import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, auth } from './lib/api';
import { I18nCtx, Lang, useI18n } from './lib/i18n';
import { useEvent, useRoom } from './lib/socket';

const VEHICLE_TYPES = ['moto', 'carro', 'van', 'camioneta', 'bici'];

// ── shared bits ─────────────────────────────────────────────────
function LangToggle() {
  const { lang, setLang } = useI18n();
  return (
    <div style={{ display: 'flex', gap: 2, padding: 3, borderRadius: 8, background: 'var(--surface-2)', border: '1px solid var(--line)' }}>
      {(['es', 'en'] as Lang[]).map((l) => (
        <button key={l} onClick={() => setLang(l)} className="mono"
          style={{ border: 'none', borderRadius: 6, padding: '3px 9px', fontSize: 11, fontWeight: 600,
            background: lang === l ? 'var(--ink-900)' : 'transparent', color: lang === l ? '#fff' : 'var(--ink-500)' }}>
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  );
}

const tierBadge: Record<string, string> = {
  elite: 'badge-brand', preferente: 'badge-blue', estandar: 'badge-gray', nuevo: 'badge-amber',
};
const statusBadge: Record<string, string> = {
  enroute: 'badge-blue', delivering: 'badge-brand', idle: 'badge-gray', offduty: 'badge-gray',
};

// ── login ───────────────────────────────────────────────────────
function Login({ onDone }: { onDone: () => void }) {
  const { t } = useI18n();
  const [email, setEmail] = useState('dispatch@sherpa-c.com');
  const [password, setPassword] = useState('sherpa123');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setErr('');
    try {
      const r = await api.login(email, password);
      auth.set(r);
      onDone();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: 'var(--ink-900)' }}>
      <div style={{ position: 'fixed', inset: 0, opacity: 0.5, pointerEvents: 'none',
        background: 'radial-gradient(80% 60% at 70% -10%, oklch(0.45 0.11 168 / .55), transparent 60%)' }} />
      <form onSubmit={submit} className="card" style={{ width: 380, padding: 28, position: 'relative', zIndex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
          <div style={{ width: 34, height: 34, borderRadius: 9, background: 'var(--brand)' }} />
          <span className="display" style={{ fontSize: 18, fontWeight: 600 }}>Sherpa<span style={{ color: 'var(--brand-600)' }}>LM</span> · Ops</span>
        </div>
        <label className="field-label">{t('Correo', 'Email')}</label>
        <input className="input" value={email} onChange={(e) => setEmail(e.target.value)} style={{ marginBottom: 12 }} />
        <label className="field-label">{t('Contraseña', 'Password')}</label>
        <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} style={{ marginBottom: 16 }} />
        {err && <div className="badge badge-red" style={{ marginBottom: 12 }}>{err}</div>}
        <button className="btn btn-primary btn-block btn-lg" disabled={busy}>
          {busy ? '…' : t('Ingresar', 'Sign in')}
        </button>
        <p style={{ fontSize: 12, color: 'var(--ink-500)', marginTop: 14, textAlign: 'center' }}>
          admin · dispatch · security @sherpa-c.com / sherpa123
        </p>
      </form>
    </div>
  );
}

// ── ops shell ───────────────────────────────────────────────────
const TABS = [
  ['dashboard', 'Panel', 'Dashboard'],
  ['map', 'Mapa en vivo', 'Live map'],
  ['approvals', 'Aprobaciones', 'Approvals'],
  ['compliance', 'Cumplimiento', 'Compliance'],
  ['freight', 'Fletes', 'Freight'],
  ['drivers', 'Conductores', 'Drivers'],
] as const;

// Bogotá bounding box -> 0..100% map space
const BOGOTA = { minLng: -74.2, maxLng: -74.0, minLat: 4.55, maxLat: 4.78 };
const toXY = (lng: number, lat: number) => ({
  x: Math.max(0, Math.min(100, ((lng - BOGOTA.minLng) / (BOGOTA.maxLng - BOGOTA.minLng)) * 100)),
  y: Math.max(0, Math.min(100, (1 - (lat - BOGOTA.minLat) / (BOGOTA.maxLat - BOGOTA.minLat)) * 100)),
});
const tierColor: Record<string, string> = { elite: 'var(--brand)', preferente: 'var(--blue)', estandar: 'var(--ink-500)', nuevo: 'var(--amber)' };

function Shell({ me, onLogout }: { me: any; onLogout: () => void }) {
  const { t } = useI18n();
  const [tab, setTab] = useState<string>('dashboard');

  return (
    <div style={{ display: 'flex', height: '100vh', background: 'var(--paper)' }}>
      {/* sidebar */}
      <div style={{ width: 230, flexShrink: 0, background: 'var(--ink-900)', color: '#fff', display: 'flex', flexDirection: 'column', padding: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 28, padding: '4px 6px' }}>
          <div style={{ width: 30, height: 30, borderRadius: 8, background: 'var(--brand)' }} />
          <span className="display" style={{ fontSize: 16, fontWeight: 600 }}>Sherpa<span style={{ color: 'var(--brand)' }}>LM</span></span>
        </div>
        {TABS.map(([id, es, en]) => (
          <button key={id} onClick={() => setTab(id)}
            style={{ textAlign: 'left', border: 'none', borderRadius: 9, padding: '10px 12px', marginBottom: 4,
              fontSize: 14, fontWeight: 600, background: tab === id ? 'var(--brand)' : 'transparent',
              color: tab === id ? '#063' : 'rgba(255,255,255,.65)' }}>
            {t(es, en)}
          </button>
        ))}
        <div style={{ marginTop: 'auto', fontSize: 12, color: 'rgba(255,255,255,.5)' }}>
          <div style={{ marginBottom: 8 }}>{me?.email}<br /><span className="mono">{me?.role}</span></div>
          <button onClick={onLogout} className="btn btn-ghost" style={{ color: '#fff', borderColor: 'rgba(255,255,255,.2)', width: '100%' }}>
            {t('Salir', 'Sign out')}
          </button>
        </div>
      </div>

      {/* main */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', borderBottom: '1px solid var(--line)', background: 'var(--surface)' }}>
          <div>
            <span className="eyebrow">{t('Operaciones · Bogotá', 'Operations · Bogotá')}</span>
            <h1 className="display" style={{ fontSize: 22, margin: '2px 0 0' }}>
              {t(TABS.find((x) => x[0] === tab)![1], TABS.find((x) => x[0] === tab)![2])}
            </h1>
          </div>
          <LangToggle />
        </div>
        <div className="scroll" style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
          {tab === 'dashboard' && <Dashboard />}
          {tab === 'map' && <LiveMap />}
          {tab === 'approvals' && <Approvals role={me?.role} />}
          {tab === 'compliance' && <Compliance />}
          {tab === 'freight' && <FreightScreen />}
          {tab === 'drivers' && <Drivers />}
        </div>
      </div>
    </div>
  );
}

function Kpi({ label, value, sub }: { label: string; value: any; sub?: string }) {
  return (
    <div className="card" style={{ padding: 18 }}>
      <div className="eyebrow">{label}</div>
      <div className="display" style={{ fontSize: 32, margin: '6px 0 0' }}>{value}</div>
      {sub && <div style={{ fontSize: 12.5, color: 'var(--ink-500)' }}>{sub}</div>}
    </div>
  );
}

function Dashboard() {
  const { t } = useI18n();
  const [o, setO] = useState<any>(null);
  useEffect(() => { api.overview().then(setO).catch(() => {}); }, []);
  if (!o) return <div style={{ color: 'var(--ink-500)' }}>…</div>;
  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16 }}>
        <Kpi label={t('Conductores', 'Drivers')} value={o.drivers} sub={`${o.driversMoving} ${t('en movimiento', 'moving')}`} />
        <Kpi label={t('Solicitudes', 'Applications')} value={o.applications} sub={t('en cola', 'in queue')} />
        <Kpi label={t('Fletes', 'Freight')} value={o.freights} sub={t('disponibles', 'available')} />
        <Kpi label={t('Etapas de aprobación', 'Approval stages')} value={o.config.approvalStages} sub={t('configurables', 'configurable')} />
      </div>
      <div className="card" style={{ padding: 18 }}>
        <div className="eyebrow" style={{ marginBottom: 10 }}>{t('Configuración (editable, no hardcode)', 'Configuration (editable, not hardcoded)')}</div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <span className="badge badge-gray">{o.config.documentTypes} {t('tipos de documento', 'document types')}</span>
          <span className="badge badge-gray">{o.config.operatingAreas} {t('zonas operativas', 'operating areas')}</span>
          <span className="badge badge-gray">{o.config.approvalStages} {t('etapas', 'stages')}</span>
        </div>
      </div>
    </div>
  );
}

const CHECK_RESULTS = ['pass', 'flag', 'pending', 'fail'] as const;
const checkBadge: Record<string, string> = { pass: 'badge-brand', flag: 'badge-red', fail: 'badge-red', pending: 'badge-gray' };

function Approvals({ role }: { role?: string }) {
  const { t, lang } = useI18n();
  const [rows, setRows] = useState<any[]>([]);
  const [sel, setSel] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState('');

  const load = () => api.queue().then(setRows).catch(() => {});
  useEffect(() => { load(); }, []);
  const open = (id: string) => api.approval(id).then((d) => { setSel(d); setReason(''); });

  const canDecide = sel?.currentStage && (role === 'admin' || sel.currentStage.responsibleRole === role) && sel.currentStage.mode === 'manual';

  const decide = async (outcome: 'pass' | 'fail' | 'return') => {
    if (!sel) return;
    setBusy(true);
    try {
      await api.decide(sel.id, outcome, reason || undefined);
      await load();
      // refresh or close
      const next = await api.approval(sel.id).catch(() => null);
      setSel(next && (next.status === 'in_review' || next.status === 'returned') ? next : null);
    } finally { setBusy(false); }
  };

  const setCheck = async (check: string, result: string) => {
    if (!sel) return;
    await api.securityCheck(sel.id, check, result);
    open(sel.id);
  };

  return (
    <div style={{ display: 'flex', gap: 18, alignItems: 'flex-start' }}>
      {/* queue */}
      <div style={{ flex: 1, display: 'grid', gap: 12, minWidth: 0 }}>
        {rows.map((a) => (
          <button key={a.id} onClick={() => open(a.id)} className="card"
            style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 16, textAlign: 'left', cursor: 'pointer',
              borderColor: sel?.id === a.id ? 'var(--brand)' : 'var(--line)' }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="mono" style={{ fontSize: 12, color: 'var(--ink-500)' }}>{a.reference}</span>
                <strong>{a.name}</strong>
                {a.currentStage?.isSecurity && <span className="badge badge-amber">{t('Seguridad', 'Security')}</span>}
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--ink-500)', marginTop: 2 }}>{a.vehicle} · {a.plate} · {(a.zones || []).join(', ')}</div>
            </div>
            <span className="badge badge-blue">{a.currentStage ? (lang === 'es' ? a.currentStage.nameEs : a.currentStage.nameEn) : a.status}</span>
          </button>
        ))}
        {!rows.length && <div style={{ color: 'var(--ink-500)' }}>{t('Cola vacía', 'Queue empty')}</div>}
      </div>

      {/* review panel */}
      {sel && (
        <div className="card" style={{ width: 380, flexShrink: 0, padding: 20, position: 'sticky', top: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="eyebrow">{sel.reference}</span>
            <button onClick={() => setSel(null)} className="btn btn-ghost" style={{ padding: '4px 10px' }}>✕</button>
          </div>
          <h2 className="display" style={{ fontSize: 22, margin: '6px 0 2px' }}>{sel.name}</h2>
          <div style={{ fontSize: 13, color: 'var(--ink-500)', marginBottom: 14 }}>{sel.vehicle} · {sel.plate} · {(sel.zones || []).join(', ')}</div>

          <div className="eyebrow" style={{ marginBottom: 8 }}>{t('Etapa actual', 'Current stage')}</div>
          <div style={{ marginBottom: 16 }}>
            <span className="badge badge-blue">{lang === 'es' ? sel.currentStage?.nameEs : sel.currentStage?.nameEn}</span>
            <span className="badge badge-gray" style={{ marginLeft: 6 }}>{sel.currentStage?.responsibleRole}</span>
          </div>

          <div className="eyebrow" style={{ marginBottom: 8 }}>{t('Verificación de seguridad', 'Security checks')}</div>
          <div style={{ display: 'grid', gap: 8, marginBottom: 16 }}>
            {Object.entries(sel.securityChecks || {}).map(([k, v]) => (
              <div key={k} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 13 }}>{k}</span>
                <div style={{ display: 'flex', gap: 4 }}>
                  {CHECK_RESULTS.map((r) => (
                    <button key={r} onClick={() => setCheck(k, r)} disabled={role !== 'admin' && role !== 'security_officer'}
                      className={`badge ${v === r ? checkBadge[r] : 'badge-gray'}`}
                      style={{ cursor: 'pointer', opacity: v === r ? 1 : 0.5, border: 'none' }}>{r}</button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="eyebrow" style={{ marginBottom: 8 }}>{t('Documentos', 'Documents')}</div>
          <div style={{ display: 'grid', gap: 6, marginBottom: 16 }}>
            {(sel.documents || []).map((d: any) => (
              <div key={d.key} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span>{d.name}</span>
                <span className={`badge ${d.status === 'approved' ? 'badge-brand' : d.status === 'rejected' || d.status === 'expired' ? 'badge-red' : 'badge-gray'}`}>{d.status}</span>
              </div>
            ))}
            {!sel.documents?.length && <span style={{ fontSize: 12.5, color: 'var(--ink-500)' }}>{t('Solicitud de demostración (sin documentos)', 'Demo application (no documents)')}</span>}
          </div>

          {canDecide ? (<>
            <textarea className="textarea" placeholder={t('Motivo (opcional)', 'Reason (optional)')} value={reason} onChange={(e) => setReason(e.target.value)} rows={2} style={{ marginBottom: 10 }} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <button className="btn btn-primary" disabled={busy} onClick={() => decide('pass')}>{t('Aprobar etapa', 'Pass stage')}</button>
              <button className="btn btn-ghost" disabled={busy} onClick={() => decide('return')}>{t('Devolver', 'Return')}</button>
              <button className="btn btn-danger" disabled={busy} onClick={() => decide('fail')} style={{ gridColumn: '1 / -1' }}>{t('Rechazar', 'Reject')}</button>
            </div>
          </>) : (
            <div className="badge badge-gray" style={{ width: '100%', justifyContent: 'center', padding: 10 }}>
              {t('Esta etapa la decide ', 'This stage is decided by ')}{sel.currentStage?.responsibleRole}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Compliance() {
  const { t } = useI18n();
  const [rows, setRows] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const [summary, setSummary] = useState<any>(null);

  const load = () => api.compliance(90).then(setRows).catch(() => {});
  useEffect(() => { load(); }, []);

  const scan = async () => {
    setBusy(true);
    try { setSummary(await api.runScan()); await load(); } finally { setBusy(false); }
  };
  const renew = async (id: string) => {
    const d = new Date(); d.setFullYear(d.getFullYear() + 1);
    await api.renewDoc(id, d.toISOString().slice(0, 10));
    await load();
  };

  const tone = (days: number, status: string) =>
    status === 'expired' || days < 0 ? 'badge-red' : days <= 15 ? 'badge-amber' : 'badge-gray';

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 13.5, color: 'var(--ink-500)' }}>
          {t('Documentos rastreados que vencen pronto o ya vencidos. La suspensión de elegibilidad es automática.',
             'Tracked documents expiring soon or already expired. Eligibility suspension is automatic.')}
        </div>
        <button className="btn btn-dark" disabled={busy} onClick={scan}>{busy ? '…' : t('Ejecutar escaneo', 'Run scan')}</button>
      </div>
      {summary && (
        <div className="card" style={{ padding: 14, display: 'flex', gap: 14 }}>
          <span className="badge badge-gray">{t('Escaneados', 'Scanned')}: {summary.scanned}</span>
          <span className="badge badge-blue">{t('Recordatorios', 'Reminders')}: {summary.remindersSent}</span>
          <span className="badge badge-red">{t('Vencidos', 'Expired')}: {summary.newlyExpired}</span>
          <span className="badge badge-amber">{t('Suspendidos', 'Suspended')}: {summary.suspended}</span>
        </div>
      )}
      <div className="card" style={{ overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr style={{ textAlign: 'left', color: 'var(--ink-500)', background: 'var(--surface-2)' }}>
              <th style={{ padding: '10px 16px' }}>{t('Conductor', 'Driver')}</th>
              <th style={{ padding: '10px 16px' }}>{t('Documento', 'Document')}</th>
              <th style={{ padding: '10px 16px' }}>{t('Vence', 'Expiry')}</th>
              <th style={{ padding: '10px 16px' }}>{t('Días', 'Days')}</th>
              <th style={{ padding: '10px 16px' }}></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((d) => (
              <tr key={d.id} style={{ borderTop: '1px solid var(--line)' }}>
                <td style={{ padding: '12px 16px', fontWeight: 600 }}>{d.driver}</td>
                <td style={{ padding: '12px 16px' }}>{d.document}{d.required && <span className="badge badge-gray" style={{ marginLeft: 6 }}>req</span>}</td>
                <td style={{ padding: '12px 16px' }} className="mono">{d.expiryDate}</td>
                <td style={{ padding: '12px 16px' }}><span className={`badge ${tone(d.daysLeft, d.status)}`}>{d.daysLeft}d</span></td>
                <td style={{ padding: '12px 16px' }}><button className="btn btn-ghost" style={{ padding: '6px 12px' }} onClick={() => renew(d.id)}>{t('Renovar +1a', 'Renew +1y')}</button></td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && <div style={{ padding: 16, color: 'var(--ink-500)' }}>{t('Sin documentos próximos a vencer', 'No documents expiring soon')}</div>}
      </div>
    </div>
  );
}

function LiveMap() {
  const { t } = useI18n();
  const [drivers, setDrivers] = useState<Record<string, any>>({});
  const { connected } = useRoom('ops');

  useEffect(() => {
    api.live().then((list) => {
      const m: Record<string, any> = {};
      list.forEach((d) => (m[d.id] = d));
      setDrivers(m);
    }).catch(() => {});
  }, []);

  useEvent('driver.location', useCallback((p: any) => {
    setDrivers((prev) => ({ ...prev, [p.driverId]: { ...(prev[p.driverId] || { id: p.driverId }), lng: p.lng, lat: p.lat } }));
  }, []));

  const list = Object.values(drivers).filter((d: any) => d.lng != null);
  const moving = list.filter((d: any) => d.status === 'enroute' || d.status === 'delivering').length;

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <span className="badge badge-brand">{list.length} {t('conductores', 'drivers')}</span>
        <span className="badge badge-blue">{moving} {t('en movimiento', 'moving')}</span>
        <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
          <span style={{ width: 7, height: 7, borderRadius: 99, background: connected ? 'var(--brand)' : 'var(--ink-400)' }} className={connected ? 'live-dot' : ''} />
          <span className="mono" style={{ color: 'var(--ink-500)' }}>{connected ? 'WS' : '—'}</span>
        </span>
      </div>
      <div className="card map-grid" style={{ position: 'relative', height: 560, overflow: 'hidden' }}>
        {list.map((d: any) => {
          const { x, y } = toXY(d.lng, d.lat);
          return (
            <div key={d.id} style={{ position: 'absolute', left: `${x}%`, top: `${y}%`, transform: 'translate(-50%,-50%)', transition: 'left 1.2s linear, top 1.2s linear' }}>
              <div style={{ width: 14, height: 14, borderRadius: 99, background: tierColor[d.tier] || 'var(--ink-500)', border: '2px solid #fff', boxShadow: 'var(--shadow)' }} />
              {d.name && <div className="mono" style={{ fontSize: 10, marginTop: 2, color: 'var(--ink-700)', whiteSpace: 'nowrap', transform: 'translateX(-50%)', marginLeft: 7 }}>{d.name.split(' ')[0]}</div>}
            </div>
          );
        })}
        {!list.length && <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: 'var(--ink-500)' }}>{t('Sin conductores activos', 'No active drivers')}</div>}
      </div>
    </div>
  );
}

function FreightScreen() {
  const { t } = useI18n();
  const [rows, setRows] = useState<any[]>([]);
  const [zones, setZones] = useState<any[]>([]);
  const [feed, setFeed] = useState<any[]>([]);
  const [busy, setBusy] = useState('');
  const [form, setForm] = useState<any>({ client: '', pickupZone: 'chico', dropZone: 'usaquen', requiredVehicle: 'moto', weightKg: 6, payout: 18000, priority: false });
  const { connected } = useRoom('ops');

  const load = () => api.freight().then(setRows).catch(() => {});
  useEffect(() => { load(); api.zones().then(setZones).catch(() => {}); }, []);

  const pushFeed = useCallback((kind: string, payload: any) => {
    setFeed((f) => [{ kind, payload, ts: new Date().toLocaleTimeString() }, ...f].slice(0, 20));
  }, []);
  useEvent('tender.offer', useCallback((p: any) => pushFeed('offer', p), [pushFeed]));
  useEvent('tender.resolved', useCallback((p: any) => { pushFeed('resolved', p); load(); }, [pushFeed]));

  const create = async () => {
    setBusy('create');
    try { await api.createFreight({ ...form, weightKg: Number(form.weightKg), payout: Number(form.payout) }); await load(); }
    finally { setBusy(''); }
  };
  const broadcast = async (id: string) => {
    setBusy(id);
    try { const r = await api.broadcast(id); pushFeed('broadcast', r); await load(); }
    finally { setBusy(''); }
  };

  const statusBadgeF: Record<string, string> = { available: 'badge-gray', broadcasting: 'badge-amber', assigned: 'badge-brand', completed: 'badge-blue', cancelled: 'badge-red' };

  return (
    <div style={{ display: 'flex', gap: 18, alignItems: 'flex-start' }}>
      <div style={{ flex: 1, display: 'grid', gap: 16, minWidth: 0 }}>
        {/* create form */}
        <div className="card" style={{ padding: 18 }}>
          <div className="eyebrow" style={{ marginBottom: 12 }}>{t('Nuevo flete', 'New freight')}</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
            <input className="input" placeholder={t('Cliente', 'Client')} value={form.client} onChange={(e) => setForm({ ...form, client: e.target.value })} />
            <select className="select" value={form.pickupZone} onChange={(e) => setForm({ ...form, pickupZone: e.target.value })}>{zones.map((z) => <option key={z.slug} value={z.slug}>{t('Recoge', 'Pick')}: {z.nameEs}</option>)}</select>
            <select className="select" value={form.dropZone} onChange={(e) => setForm({ ...form, dropZone: e.target.value })}>{zones.map((z) => <option key={z.slug} value={z.slug}>{t('Entrega', 'Drop')}: {z.nameEs}</option>)}</select>
            <select className="select" value={form.requiredVehicle} onChange={(e) => setForm({ ...form, requiredVehicle: e.target.value })}>{VEHICLE_TYPES.map((v) => <option key={v} value={v}>{v}</option>)}</select>
            <input className="input mono" type="number" placeholder="kg" value={form.weightKg} onChange={(e) => setForm({ ...form, weightKg: e.target.value })} />
            <input className="input mono" type="number" placeholder="$ payout" value={form.payout} onChange={(e) => setForm({ ...form, payout: e.target.value })} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13.5 }}>
              <input type="checkbox" checked={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.checked })} />
              {t('Prioritario (élite primero)', 'Priority (elite first)')}
            </label>
            <button className="btn btn-dark" disabled={!form.client || busy === 'create'} onClick={create}>{t('Crear flete', 'Create freight')}</button>
          </div>
        </div>

        {/* freight list */}
        <div className="card" style={{ overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead><tr style={{ textAlign: 'left', color: 'var(--ink-500)', background: 'var(--surface-2)' }}>
              <th style={{ padding: '10px 16px' }}>{t('Flete', 'Freight')}</th>
              <th style={{ padding: '10px 16px' }}>{t('Ruta', 'Route')}</th>
              <th style={{ padding: '10px 16px' }}>{t('Veh.', 'Veh.')}</th>
              <th style={{ padding: '10px 16px' }}>{t('Pago', 'Payout')}</th>
              <th style={{ padding: '10px 16px' }}>{t('Estado', 'Status')}</th>
              <th></th>
            </tr></thead>
            <tbody>
              {rows.map((f) => (
                <tr key={f.id} style={{ borderTop: '1px solid var(--line)' }}>
                  <td style={{ padding: '12px 16px', fontWeight: 600 }}>{f.reference}{f.priority && <span className="badge badge-amber" style={{ marginLeft: 6 }}>★</span>}
                    <div className="mono" style={{ fontSize: 11, color: 'var(--ink-500)', fontWeight: 400 }}>{f.client}</div>
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: 13 }}>{f.pickupZone} → {f.dropZone}</td>
                  <td style={{ padding: '12px 16px' }}>{f.requiredVehicle}</td>
                  <td style={{ padding: '12px 16px' }} className="mono">${(f.payout || 0).toLocaleString('es-CO')}</td>
                  <td style={{ padding: '12px 16px' }}><span className={`badge ${statusBadgeF[f.status] || 'badge-gray'}`}>{f.status}{f.assignedTo ? ` · ${f.assignedTo}` : ''}</span></td>
                  <td style={{ padding: '12px 16px' }}>
                    {(f.status === 'available' || f.status === 'broadcasting') && (
                      <button className="btn btn-primary" style={{ padding: '6px 12px' }} disabled={busy === f.id} onClick={() => broadcast(f.id)}>{t('Difundir', 'Broadcast')}</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* live feed */}
      <div className="card" style={{ width: 320, flexShrink: 0, padding: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <span className="eyebrow">{t('En vivo', 'Live')}</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
            <span style={{ width: 7, height: 7, borderRadius: 99, background: connected ? 'var(--brand)' : 'var(--ink-400)' }} className={connected ? 'live-dot' : ''} />
            <span className="mono" style={{ color: 'var(--ink-500)' }}>{connected ? 'WS' : '—'}</span>
          </span>
        </div>
        <div style={{ display: 'grid', gap: 8 }}>
          {feed.map((e, i) => (
            <div key={i} className="fade-up" style={{ fontSize: 12.5, padding: 10, borderRadius: 9, background: 'var(--surface-2)', border: '1px solid var(--line)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span className={`badge ${e.kind === 'resolved' ? 'badge-brand' : e.kind === 'offer' ? 'badge-blue' : 'badge-amber'}`}>{e.kind}</span>
                <span className="mono" style={{ color: 'var(--ink-400)' }}>{e.ts}</span>
              </div>
              <div style={{ marginTop: 6, color: 'var(--ink-600)' }}>
                {e.kind === 'offer' && `${e.payload.freight?.reference} · wave ${e.payload.wave} → ${e.payload.offeredCount ?? '?'} ${t('conductores', 'drivers')}`}
                {e.kind === 'resolved' && `${e.payload.outcome}${e.payload.driverId ? ' · ' + e.payload.driverId.slice(0, 8) : ''}`}
                {e.kind === 'broadcast' && `${e.payload.reference} · ${t('pool', 'pool')} ${e.payload.poolSize}`}
              </div>
            </div>
          ))}
          {!feed.length && <div style={{ fontSize: 12.5, color: 'var(--ink-500)' }}>{t('Difunde un flete para ver eventos', 'Broadcast a freight to see events')}</div>}
        </div>
      </div>
    </div>
  );
}

function Drivers() {
  const { t } = useI18n();
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => { api.drivers().then(setRows).catch(() => {}); }, []);
  return (
    <div className="card" style={{ overflow: 'hidden' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
        <thead>
          <tr style={{ textAlign: 'left', color: 'var(--ink-500)', background: 'var(--surface-2)' }}>
            <th style={{ padding: '10px 16px' }}>{t('Conductor', 'Driver')}</th>
            <th style={{ padding: '10px 16px' }}>{t('Vehículo', 'Vehicle')}</th>
            <th style={{ padding: '10px 16px' }}>{t('Nivel', 'Tier')}</th>
            <th style={{ padding: '10px 16px' }}>{t('Puntaje', 'Score')}</th>
            <th style={{ padding: '10px 16px' }}>{t('Rating', 'Rating')}</th>
            <th style={{ padding: '10px 16px' }}>{t('Elegible', 'Eligible')}</th>
            <th style={{ padding: '10px 16px' }}>{t('Estado', 'Status')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((d) => (
            <tr key={d.id} style={{ borderTop: '1px solid var(--line)' }}>
              <td style={{ padding: '12px 16px', fontWeight: 600 }}>{d.name}
                <div className="mono" style={{ fontSize: 11, color: 'var(--ink-500)', fontWeight: 400 }}>{d.plate}</div>
              </td>
              <td style={{ padding: '12px 16px' }}>{d.vehicle}</td>
              <td style={{ padding: '12px 16px' }}><span className={`badge ${tierBadge[d.tier] || 'badge-gray'}`}>{d.tier}</span></td>
              <td style={{ padding: '12px 16px' }} className="mono">{Math.round(d.score)}</td>
              <td style={{ padding: '12px 16px' }} className="mono">{d.avgRating ? `★ ${Number(d.avgRating).toFixed(1)}` : '—'}</td>
              <td style={{ padding: '12px 16px' }}><span className={`badge ${d.eligible ? 'badge-brand' : 'badge-red'}`}>{d.eligible ? t('Sí', 'Yes') : 'No'}</span></td>
              <td style={{ padding: '12px 16px' }}><span className={`badge ${statusBadge[d.status] || 'badge-gray'}`}>{d.status}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── root ────────────────────────────────────────────────────────
export function App() {
  const [lang, setLang] = useState<Lang>('es');
  const [me, setMe] = useState<any>(null);
  const [ready, setReady] = useState(false);

  const i18n = useMemo(() => ({ lang, setLang, t: (es: string, en: string) => (lang === 'es' ? es : en) }), [lang]);

  const loadMe = () => api.me().then(setMe).catch(() => setMe(null)).finally(() => setReady(true));
  useEffect(() => { if (auth.access) loadMe(); else setReady(true); }, []);

  const logout = () => { auth.clear(); setMe(null); };

  return (
    <I18nCtx.Provider value={i18n}>
      {!ready ? null : me ? <Shell me={me} onLogout={logout} /> : <Login onDone={loadMe} />}
    </I18nCtx.Provider>
  );
}
