import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import * as XLSX from 'xlsx';
import { api, auth } from './lib/api';
import { I18nCtx, Lang, useI18n } from './lib/i18n';
import { useEvent, useRoom } from './lib/socket';
import { Config } from './Config';

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
  const [email, setEmail] = useState('dispatch@pasarex.com');
  const [password, setPassword] = useState('pasarex123');
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
          <span className="display" style={{ fontSize: 18, fontWeight: 600 }}>PasarEx<span style={{ color: 'var(--brand-600)' }}>LM</span> · Ops</span>
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
          admin · dispatch · security @pasarex.com / pasarex123
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
  ['reviews', 'Revisión docs', 'Doc reviews'],
  ['compliance', 'Cumplimiento', 'Compliance'],
  ['plans', 'Planes', 'Delivery plans'],
  ['drivers', 'Conductores', 'Drivers'],
  ['messages', 'Mensajes', 'Messages'],
  ['config', 'Configuración', 'Config'],
] as const;

// tabs only some roles may open (others are visible to all staff)
const TAB_ROLES: Record<string, string[]> = {
  config: ['admin'],
  messages: ['admin', 'dispatcher'],
  plans: ['admin', 'dispatcher'],
  reviews: ['admin', 'security_officer'],
};

// Barbados bounding box -> 0..100% map space
const BARBADOS = { minLng: -59.66, maxLng: -59.42, minLat: 13.04, maxLat: 13.34 };
const toXY = (lng: number, lat: number) => ({
  x: Math.max(0, Math.min(100, ((lng - BARBADOS.minLng) / (BARBADOS.maxLng - BARBADOS.minLng)) * 100)),
  y: Math.max(0, Math.min(100, (1 - (lat - BARBADOS.minLat) / (BARBADOS.maxLat - BARBADOS.minLat)) * 100)),
});
// true width:height of the bounding box (longitude compressed by latitude), so
// the map surface renders Barbados in proportion instead of stretched.
const MAP_ASPECT =
  ((BARBADOS.maxLng - BARBADOS.minLng) * Math.cos(((BARBADOS.minLat + BARBADOS.maxLat) / 2) * Math.PI / 180)) /
  (BARBADOS.maxLat - BARBADOS.minLat);
const tierColor: Record<string, string> = { elite: 'var(--brand)', preferente: 'var(--blue)', estandar: 'var(--ink-500)', nuevo: 'var(--amber)' };

const waStatusBadge: Record<string, string> = { sent: 'badge-brand', received: 'badge-blue', failed: 'badge-red', skipped: 'badge-amber' };

function Messages() {
  const { t } = useI18n();
  const [rows, setRows] = useState<any[]>([]);
  const [to, setTo] = useState('');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const { connected } = useRoom('ops');

  useEffect(() => { api.whatsappMessages().then(setRows).catch(() => {}); }, []);
  useEvent('whatsapp.message', useCallback((m: any) => {
    setRows((prev) => (prev.some((x) => x.id === m.id) ? prev : [m, ...prev]));
  }, []));

  const send = async () => {
    if (!to.trim() || !text.trim()) return;
    setBusy(true); setNote('');
    try {
      const m = await api.whatsappSend(to.trim(), text.trim());
      setRows((prev) => (prev.some((x) => x.id === m.id) ? prev : [m, ...prev]));
      setText('');
      if (m.status === 'skipped') setNote(t('Sin EVOLUTION_API_KEY — el mensaje se registró pero no se envió.', 'No EVOLUTION_API_KEY — message logged but not sent.'));
      else if (m.status === 'failed') setNote(t('Falló el envío — revisa la configuración de Evolution.', 'Send failed — check the Evolution configuration.'));
    } catch (e: any) { setNote(e.message); }
    finally { setBusy(false); }
  };

  return (
    <div style={{ display: 'flex', gap: 18, alignItems: 'flex-start', flexWrap: 'wrap' }}>
      {/* composer */}
      <div className="card" style={{ width: 340, maxWidth: '100%', flexShrink: 0, padding: 18 }}>
        <div className="eyebrow" style={{ marginBottom: 10 }}>{t('Enviar WhatsApp', 'Send WhatsApp')}</div>
        <label className="field-label">{t('Número', 'Number')}</label>
        <input className="input mono" value={to} onChange={(e) => setTo(e.target.value)} placeholder="+1 246 555 0100" style={{ marginBottom: 10 }} />
        <label className="field-label">{t('Mensaje', 'Message')}</label>
        <textarea className="textarea" rows={4} value={text} onChange={(e) => setText(e.target.value)} placeholder={t('Escribe un mensaje…', 'Type a message…')} style={{ marginBottom: 10 }} />
        {note && <div className="badge badge-amber" style={{ marginBottom: 10, whiteSpace: 'normal', height: 'auto', padding: 8 }}>{note}</div>}
        <button className="btn btn-primary btn-block" disabled={busy || !to.trim() || !text.trim()} onClick={send}>{busy ? '…' : t('Enviar', 'Send')}</button>
        <p style={{ fontSize: 11.5, color: 'var(--ink-500)', marginTop: 12, lineHeight: 1.45 }}>
          {t('Requiere EVOLUTION_API_KEY y una instancia conectada. Los mensajes entrantes llegan por webhook.',
             'Requires EVOLUTION_API_KEY and a connected instance. Inbound messages arrive via webhook.')}
        </p>
      </div>

      {/* log */}
      <div style={{ flex: 1, minWidth: 260, display: 'grid', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span className="eyebrow">{t('Conversaciones', 'Message log')}</span>
          <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
            <span style={{ width: 7, height: 7, borderRadius: 99, background: connected ? 'var(--brand)' : 'var(--ink-400)' }} className={connected ? 'live-dot' : ''} />
            <span className="mono" style={{ color: 'var(--ink-500)' }}>{connected ? 'WS' : '—'}</span>
          </span>
        </div>
        {!rows.length && <div className="card" style={{ padding: 16, color: 'var(--ink-500)', fontSize: 13 }}>{t('Sin mensajes todavía.', 'No messages yet.')}</div>}
        {rows.map((m) => {
          const out = m.direction === 'out';
          return (
            <div key={m.id} className="card" style={{ padding: 12, borderLeft: `3px solid ${out ? 'var(--brand)' : 'var(--blue)'}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span className="badge badge-gray">{out ? t('Enviado', 'Outbound') : t('Recibido', 'Inbound')}</span>
                <span className="mono" style={{ fontSize: 12, color: 'var(--ink-600)' }}>{m.contact}</span>
                <span className={`badge ${waStatusBadge[m.status] || 'badge-gray'}`} style={{ marginLeft: 'auto' }}>{m.status}</span>
              </div>
              <div style={{ fontSize: 13.5, whiteSpace: 'pre-wrap' }}>{m.body}</div>
              <div className="mono" style={{ fontSize: 10.5, color: 'var(--ink-400)', marginTop: 4 }}>{m.at ? new Date(m.at).toLocaleString() : ''}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const CAP_TYPES: Array<[string, string]> = [['van', 'Van'], ['carro', 'Car'], ['moto', 'Moto'], ['camioneta', 'Pickup'], ['bici', 'Bike']];
const planLineBadge: Record<string, string> = { pending: 'badge-gray', broadcasting: 'badge-blue', filled: 'badge-brand', cancelled: 'badge-red' };

function DeliveryPlans() {
  const { t, lang } = useI18n();
  const [zones, setZones] = useState<any[]>([]);
  const [rows, setRows] = useState<any[]>([{ parish: '', packages: 100, preassigned: '' }]);
  const [caps, setCaps] = useState<Record<string, number>>({ van: 120, carro: 80, moto: 50, camioneta: 150, bici: 20 });
  const [name, setName] = useState('');
  const [opDate, setOpDate] = useState<string>(() => new Date(Date.now() + 86400000).toISOString().slice(0, 10)); // default tomorrow
  const [plans, setPlans] = useState<any[]>([]);
  const [sel, setSel] = useState<any>(null);
  const [busy, setBusy] = useState('');
  const [note, setNote] = useState('');
  const [openLine, setOpenLine] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const { connected } = useRoom('ops');

  const loadPlans = () => api.plans().then(setPlans).catch(() => {});
  useEffect(() => { api.zones().then(setZones).catch(() => {}); loadPlans(); }, []);
  const openPlan = (id: string) => api.plan(id).then(setSel).catch(() => {});

  // live refresh the monitored plan
  const refresh = useCallback(() => { if (sel?.id) openPlan(sel.id); loadPlans(); }, [sel?.id]);
  useEvent('plan.tender.accepted', refresh);
  useEvent('plan.broadcast', refresh);

  const zoneSlug = (raw: string) => {
    const v = String(raw).toLowerCase().trim();
    const z = zones.find((z) => z.slug === v || (z.nameEn || '').toLowerCase() === v || (z.nameEs || '').toLowerCase() === v);
    return z?.slug || v;
  };

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; e.target.value = '';
    if (!file) return;
    try {
      const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
      const json: any[] = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' });
      const get = (r: any, keys: string[]) => { const k = Object.keys(r).find((kk) => keys.includes(kk.toLowerCase().trim())); return k ? r[k] : ''; };
      const parsed = json.map((r) => ({
        parish: zoneSlug(get(r, ['parish', 'zone', 'zona'])),
        packages: parseInt(String(get(r, ['packages', 'quantity', 'qty', 'paquetes'])), 10) || 0,
        preassigned: String(get(r, ['preassigned', 'drivers', 'conductores']) || '').split(/[;,]/).map((s) => s.trim()).filter(Boolean).join(', '),
      })).filter((l) => l.packages > 0);
      if (!parsed.length) { setNote(t('No se encontraron filas válidas (columnas: parish, packages, preassigned).', 'No valid rows found (columns: parish, packages, preassigned).')); return; }
      setRows(parsed); setNote(t(`${parsed.length} filas cargadas del archivo.`, `${parsed.length} rows loaded from file.`));
    } catch (err: any) { setNote(t('Error al leer el archivo: ', 'Failed to read file: ') + err.message); }
  };

  const setRow = (i: number, patch: any) => setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const addRow = () => setRows((rs) => [...rs, { parish: '', packages: 100, preassigned: '' }]);
  const delRow = (i: number) => setRows((rs) => rs.filter((_, idx) => idx !== i));

  const create = async () => {
    const lines = rows.filter((r) => r.parish && r.packages > 0).map((r) => ({
      parish: r.parish, packages: Number(r.packages),
      preassigned: String(r.preassigned || '').split(/[;,]/).map((s: string) => s.trim()).filter(Boolean),
    }));
    if (!lines.length) { setNote(t('Agrega al menos una parroquia con paquetes.', 'Add at least one parish with packages.')); return; }
    setBusy('create'); setNote('');
    try {
      const p = await api.createPlan({ name: name || undefined, operationalDate: opDate || undefined, lines, vehicleCapacities: caps });
      await loadPlans(); setSel(p);
      setNote(t(`Plan ${p.reference} creado (borrador). Ahora difúndelo.`, `Plan ${p.reference} created (draft). Now broadcast it.`));
    } catch (e: any) { setNote(e.message); } finally { setBusy(''); }
  };
  const broadcast = async (id: string) => { setBusy(id); try { setSel(await api.broadcastPlan(id)); await loadPlans(); } catch (e: any) { setNote(e.message); } finally { setBusy(''); } };

  const pctOf = (l: any) => Math.min(100, Math.round((l.acceptedPackages / Math.max(1, l.requiredPackages)) * 100));

  return (
    <div style={{ display: 'flex', gap: 18, alignItems: 'flex-start', flexWrap: 'wrap' }}>
      {/* builder */}
      <div style={{ flex: 1, minWidth: 300, display: 'grid', gap: 14 }}>
        <div className="card" style={{ padding: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <span className="eyebrow">{t('Nuevo plan de entrega', 'New delivery plan')} · {t('Recogida', 'Pickup')}: PasarEx Hub</span>
            <div>
              <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" style={{ display: 'none' }} onChange={onFile} />
              <button className="btn btn-ghost" style={{ padding: '6px 12px' }} onClick={() => fileRef.current?.click()}>{t('Subir CSV/Excel', 'Upload CSV/Excel')}</button>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
            <input className="input" placeholder={t('Nombre del plan (opcional)', 'Plan name (optional)')} value={name} onChange={(e) => setName(e.target.value)} style={{ flex: 1 }} />
            <label style={{ fontSize: 11, color: 'var(--ink-500)' }}>{t('Fecha operativa', 'Operational date')}<br />
              <input className="input mono" type="date" value={opDate} onChange={(e) => setOpDate(e.target.value)} />
            </label>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead><tr style={{ textAlign: 'left', color: 'var(--ink-500)' }}>
                <th style={{ padding: '4px 6px' }}>{t('Parroquia', 'Parish')}</th>
                <th style={{ padding: '4px 6px', width: 90 }}>{t('Paquetes', 'Packages')}</th>
                <th style={{ padding: '4px 6px' }}>{t('Pre-asignados (correos/teléfonos)', 'Pre-assigned (emails/phones)')}</th>
                <th></th>
              </tr></thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i}>
                    <td style={{ padding: '3px 6px' }}>
                      <select className="select" value={r.parish} onChange={(e) => setRow(i, { parish: e.target.value })}>
                        <option value="">—</option>
                        {zones.map((z) => <option key={z.slug} value={z.slug}>{lang === 'es' ? z.nameEs : z.nameEn}</option>)}
                      </select>
                    </td>
                    <td style={{ padding: '3px 6px' }}><input className="input mono" type="number" value={r.packages} onChange={(e) => setRow(i, { packages: e.target.value })} /></td>
                    <td style={{ padding: '3px 6px' }}><input className="input" placeholder={t('opcional', 'optional')} value={r.preassigned} onChange={(e) => setRow(i, { preassigned: e.target.value })} /></td>
                    <td style={{ padding: '3px 6px' }}><button className="btn btn-ghost" style={{ padding: '4px 9px' }} onClick={() => delRow(i)}>✕</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button className="btn btn-ghost" style={{ marginTop: 8, padding: '6px 12px' }} onClick={addRow}>+ {t('Parroquia', 'Parish')}</button>

          <div style={{ marginTop: 14 }}>
            <div className="eyebrow" style={{ marginBottom: 8 }}>{t('Paquetes por vehículo (perfil de flete)', 'Packages per vehicle (freight profile)')}</div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {CAP_TYPES.map(([k, label]) => (
                <label key={k} style={{ fontSize: 12, color: 'var(--ink-600)' }}>{t(label, label)}<br />
                  <input className="input mono" style={{ width: 70 }} type="number" value={caps[k]} onChange={(e) => setCaps({ ...caps, [k]: Number(e.target.value) })} />
                </label>
              ))}
            </div>
          </div>

          {note && <div className="badge badge-amber" style={{ marginTop: 12, whiteSpace: 'normal', height: 'auto', padding: 8 }}>{note}</div>}
          <button className="btn btn-dark btn-block" style={{ marginTop: 12 }} disabled={busy === 'create'} onClick={create}>{busy === 'create' ? '…' : t('Crear plan', 'Create plan')}</button>
        </div>

        {/* plan list */}
        <div className="card" style={{ overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead><tr style={{ textAlign: 'left', color: 'var(--ink-500)', background: 'var(--surface-2)' }}>
              <th style={{ padding: '10px 16px' }}>{t('Plan', 'Plan')}</th><th style={{ padding: '10px 16px' }}>{t('Estado', 'Status')}</th><th></th>
            </tr></thead>
            <tbody>
              {plans.map((p) => (
                <tr key={p.id} onClick={() => openPlan(p.id)} style={{ borderTop: '1px solid var(--line)', cursor: 'pointer', background: sel?.id === p.id ? 'var(--brand-tint)' : undefined }}>
                  <td style={{ padding: '10px 16px', fontWeight: 600 }}>{p.reference}<div className="mono" style={{ fontSize: 11, color: 'var(--ink-500)', fontWeight: 400 }}>{p.name || '—'}</div></td>
                  <td style={{ padding: '10px 16px' }}><span className={`badge ${p.status === 'completed' ? 'badge-brand' : p.status === 'broadcasting' ? 'badge-blue' : 'badge-gray'}`}>{p.status}</span></td>
                  <td style={{ padding: '10px 16px' }}>{p.status === 'draft' && <button className="btn btn-primary" style={{ padding: '5px 11px' }} disabled={busy === p.id} onClick={(e) => { e.stopPropagation(); broadcast(p.id); }}>{t('Difundir', 'Broadcast')}</button>}</td>
                </tr>
              ))}
              {!plans.length && <tr><td colSpan={3} style={{ padding: 16, color: 'var(--ink-500)' }}>{t('Sin planes todavía.', 'No plans yet.')}</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {/* monitor */}
      {sel && (
        <div className="card" style={{ width: 380, maxWidth: '100%', flexShrink: 0, padding: 18, position: 'sticky', top: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="eyebrow">{sel.reference}</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span className={`badge ${sel.status === 'completed' ? 'badge-brand' : sel.status === 'broadcasting' ? 'badge-blue' : 'badge-gray'}`}>{sel.status}</span>
              <span style={{ width: 7, height: 7, borderRadius: 99, background: connected ? 'var(--brand)' : 'var(--ink-400)' }} className={connected ? 'live-dot' : ''} />
            </span>
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--ink-500)', margin: '4px 0 14px' }}>{sel.operationalDate ? `${sel.operationalDate} · ` : ''}{t('Recogida', 'Pickup')}: {sel.hubName} · {t('por escasez de conductores', 'by driver scarcity')}</div>
          {sel.status === 'draft' && <button className="btn btn-primary btn-block" style={{ marginBottom: 14 }} disabled={busy === sel.id} onClick={() => broadcast(sel.id)}>{t('Difundir plan', 'Broadcast plan')}</button>}
          <div style={{ display: 'grid', gap: 12 }}>
            {sel.lines.map((l: any) => {
              const recips = l.recipients || [];
              const open = openLine === l.id;
              const rBadge = (s: string) => s === 'accepted' || s === 'auto_accepted' ? 'badge-brand' : s === 'declined' ? 'badge-amber' : s === 'cancelled' ? 'badge-red' : 'badge-gray';
              return (
              <div key={l.id} onClick={() => setOpenLine(open ? null : l.id)} style={{ cursor: recips.length ? 'pointer' : 'default' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
                  <span style={{ fontWeight: 600, fontSize: 13.5 }}>{zones.find((z) => z.slug === l.parish) ? (lang === 'es' ? zones.find((z) => z.slug === l.parish).nameEs : zones.find((z) => z.slug === l.parish).nameEn) : l.parish}</span>
                  <span className="mono" style={{ fontSize: 12 }}>{l.acceptedPackages}/{l.requiredPackages}</span>
                </div>
                <div style={{ height: 7, borderRadius: 99, background: 'var(--line)', overflow: 'hidden' }}>
                  <div style={{ width: `${pctOf(l)}%`, height: '100%', background: l.status === 'filled' ? 'var(--brand)' : 'var(--blue)', transition: 'width .4s' }} />
                </div>
                <div style={{ display: 'flex', gap: 6, marginTop: 5, flexWrap: 'wrap', alignItems: 'center' }}>
                  <span className={`badge ${planLineBadge[l.status] || 'badge-gray'}`}>{l.status}</span>
                  <span className="mono" style={{ fontSize: 11, color: 'var(--ink-500)' }}>{l.eligibleCount} {t('elegibles', 'eligible')}</span>
                  <span className="mono" style={{ fontSize: 11, color: 'var(--ink-500)' }}>· {l.tenders.accepted + l.tenders.autoAccepted} {t('acept.', 'acc.')} / {l.tenders.offered} {t('ofrec.', 'off.')}</span>
                  {l.preassignedCount > 0 && <span className="badge badge-amber">{l.preassignedCount} {t('pre-asig.', 'pre-assgn')}</span>}
                  {recips.length > 0 && <span className="mono" style={{ fontSize: 11, color: 'var(--brand-ink)', marginLeft: 'auto' }}>{open ? '▾' : '▸'} {recips.length} {t('enviados', 'sent to')}</span>}
                </div>
                {open && recips.length > 0 && (
                  <div style={{ marginTop: 8, padding: '8px 10px', background: 'var(--surface-2)', borderRadius: 9, display: 'grid', gap: 6 }}>
                    {recips.map((r: any, i: number) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5 }}>
                        <span style={{ flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.name}{r.preassigned ? ' ★' : ''}</span>
                        <span className="mono" style={{ fontSize: 11, color: 'var(--ink-500)' }}>{r.vehicle} · {r.packages}</span>
                        <span className={`badge ${rBadge(r.status)}`}>{r.status === 'auto_accepted' ? t('auto', 'auto') : r.status}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );})}
          </div>
        </div>
      )}
    </div>
  );
}

function useIsMobile(bp = 820) {
  const [m, setM] = useState<boolean>(typeof window !== 'undefined' ? window.innerWidth <= bp : false);
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${bp}px)`);
    const on = () => setM(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [bp]);
  return m;
}

function Shell({ me, onLogout }: { me: any; onLogout: () => void }) {
  const { t } = useI18n();
  const [tab, setTab] = useState<string>('dashboard');
  const isMobile = useIsMobile();
  const [drawer, setDrawer] = useState(false);
  const pick = (id: string) => { setTab(id); setDrawer(false); };

  // live count of documents awaiting review — the security "notification"
  const canReview = me?.role === 'admin' || me?.role === 'security_officer';
  const [reviewCount, setReviewCount] = useState(0);
  const refreshReviewCount = useCallback(() => {
    if (canReview) api.documentReviewCount().then((r) => setReviewCount(r.pending)).catch(() => {});
  }, [canReview]);
  useRoom('ops');
  useEffect(() => { refreshReviewCount(); }, [refreshReviewCount]);
  useEvent('document.pending', useCallback(() => refreshReviewCount(), [refreshReviewCount]));
  useEvent('document.reviewed', useCallback(() => refreshReviewCount(), [refreshReviewCount]));

  return (
    <div style={{ display: 'flex', height: '100vh', maxHeight: '100dvh', background: 'var(--paper)' }}>
      {/* sidebar — fixed off-canvas drawer on mobile, static column on desktop */}
      <div style={{
        width: 230, flexShrink: 0, background: 'var(--ink-900)', color: '#fff',
        display: 'flex', flexDirection: 'column', padding: 16,
        ...(isMobile ? {
          position: 'fixed', top: 0, bottom: 0, left: 0, zIndex: 50, width: 250,
          transform: drawer ? 'translateX(0)' : 'translateX(-100%)',
          transition: 'transform .25s ease', boxShadow: drawer ? 'var(--shadow-lg)' : 'none',
        } : {}),
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 28, padding: '4px 6px' }}>
          <div style={{ width: 30, height: 30, borderRadius: 8, background: 'var(--brand)' }} />
          <span className="display" style={{ fontSize: 16, fontWeight: 600 }}>PasarEx<span style={{ color: 'var(--brand)' }}>LM</span></span>
        </div>
        {TABS.filter(([id]) => !TAB_ROLES[id] || TAB_ROLES[id].includes(me?.role)).map(([id, es, en]) => (
          <button key={id} onClick={() => pick(id)}
            style={{ display: 'flex', alignItems: 'center', gap: 8, textAlign: 'left', border: 'none', borderRadius: 9, padding: '10px 12px', marginBottom: 4,
              fontSize: 14, fontWeight: 600, background: tab === id ? 'var(--brand)' : 'transparent',
              color: tab === id ? '#063' : 'rgba(255,255,255,.65)' }}>
            <span style={{ flex: 1 }}>{t(es, en)}</span>
            {id === 'reviews' && reviewCount > 0 && (
              <span style={{ background: 'var(--red-ink, #d9342b)', color: '#fff', borderRadius: 999, fontSize: 11, fontWeight: 700, minWidth: 18, height: 18, padding: '0 5px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{reviewCount}</span>
            )}
          </button>
        ))}
        <div style={{ marginTop: 'auto', fontSize: 12, color: 'rgba(255,255,255,.5)' }}>
          <div style={{ marginBottom: 8 }}>{me?.email}<br /><span className="mono">{me?.role}</span></div>
          <button onClick={onLogout} className="btn btn-ghost" style={{ color: '#fff', borderColor: 'rgba(255,255,255,.2)', width: '100%' }}>
            {t('Salir', 'Sign out')}
          </button>
        </div>
      </div>
      {isMobile && drawer && (
        <div onClick={() => setDrawer(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 40 }} />
      )}

      {/* main */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: isMobile ? '12px 16px' : '16px 24px', borderBottom: '1px solid var(--line)', background: 'var(--surface)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
            {isMobile && (
              <button onClick={() => setDrawer(true)} aria-label="Menu" className="btn btn-ghost" style={{ padding: '7px 11px', fontSize: 17, lineHeight: 1 }}>☰</button>
            )}
            <div style={{ minWidth: 0 }}>
              <span className="eyebrow">{t('Operaciones · Barbados', 'Operations · Barbados')}</span>
              <h1 className="display" style={{ fontSize: isMobile ? 18 : 22, margin: '2px 0 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {t(TABS.find((x) => x[0] === tab)![1], TABS.find((x) => x[0] === tab)![2])}
              </h1>
            </div>
          </div>
          <LangToggle />
        </div>
        <div className="scroll" style={{ flex: 1, overflowY: 'auto', padding: isMobile ? 14 : 24 }}>
          {tab === 'dashboard' && <Dashboard />}
          {tab === 'map' && <LiveMap role={me?.role} />}
          {tab === 'approvals' && <Approvals role={me?.role} />}
          {tab === 'reviews' && <DocumentReviews onChanged={refreshReviewCount} />}
          {tab === 'compliance' && <Compliance />}
          {tab === 'plans' && <DeliveryPlans />}
          {tab === 'drivers' && <Drivers role={me?.role} />}
          {tab === 'messages' && <Messages />}
          {tab === 'config' && <Config />}
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
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 16 }}>
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

// Full-screen viewer for a submitted document (image or PDF), fetched with auth.
function DocViewer({ docId, name, onClose }: { docId: string; name: string; onClose: () => void }) {
  const { t } = useI18n();
  const [url, setUrl] = useState<string | null>(null);
  const [kind, setKind] = useState<'image' | 'pdf' | 'other'>('other');
  const [err, setErr] = useState(false);

  useEffect(() => {
    let obj: string | null = null;
    let live = true;
    setUrl(null); setErr(false);
    api.documentFileBlob(docId)
      .then((blob) => {
        if (!live) return;
        obj = URL.createObjectURL(blob);
        setKind(blob.type.startsWith('image/') ? 'image' : blob.type === 'application/pdf' ? 'pdf' : 'other');
        setUrl(obj);
      })
      .catch(() => live && setErr(true));
    return () => { live = false; if (obj) URL.revokeObjectURL(obj); };
  }, [docId]);

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)', zIndex: 100, display: 'grid', placeItems: 'center', padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} className="card" style={{ width: 'min(880px, 96vw)', maxHeight: '92vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid var(--line)' }}>
          <strong style={{ fontSize: 14 }}>{name}</strong>
          <div style={{ display: 'flex', gap: 8 }}>
            {url && <a className="btn btn-ghost" style={{ padding: '5px 11px' }} href={url} download={name}>{t('Descargar', 'Download')}</a>}
            <button className="btn btn-ghost" style={{ padding: '5px 11px' }} onClick={onClose}>✕</button>
          </div>
        </div>
        <div style={{ flex: 1, overflow: 'auto', display: 'grid', placeItems: 'center', background: 'var(--surface-2)', minHeight: 320 }}>
          {err && <span className="badge badge-red">{t('No se pudo cargar el archivo', 'Failed to load file')}</span>}
          {!err && !url && <span style={{ color: 'var(--ink-500)' }}>…</span>}
          {url && kind === 'image' && <img src={url} alt={name} style={{ maxWidth: '100%', maxHeight: '82vh', display: 'block' }} />}
          {url && kind === 'pdf' && <iframe title={name} src={url} style={{ width: '100%', height: '82vh', border: 'none' }} />}
          {url && kind === 'other' && <a className="btn btn-primary" href={url} download={name}>{t('Descargar archivo', 'Download file')}</a>}
        </div>
      </div>
    </div>
  );
}

function Approvals({ role }: { role?: string }) {
  const { t, lang } = useI18n();
  const [rows, setRows] = useState<any[]>([]);
  const [sel, setSel] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState('');
  const [viewDoc, setViewDoc] = useState<{ id: string; name: string } | null>(null);

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
    <div style={{ display: 'flex', gap: 18, alignItems: 'flex-start', flexWrap: 'wrap' }}>
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
        <div className="card" style={{ width: 380, maxWidth: '100%', flexShrink: 0, padding: 20, position: 'sticky', top: 0 }}>
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
          <div style={{ display: 'grid', gap: 8, marginBottom: 16 }}>
            {(sel.documents || []).map((d: any) => (
              <div key={d.id || d.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, fontSize: 13 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.name}</div>
                  {d.expiryDate && <div className="mono" style={{ fontSize: 11, color: 'var(--ink-500)' }}>{t('Vence', 'Expires')} {d.expiryDate}</div>}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                  <span className={`badge ${d.status === 'approved' ? 'badge-brand' : d.status === 'rejected' || d.status === 'expired' ? 'badge-red' : 'badge-gray'}`}>{d.status}</span>
                  {d.hasFile
                    ? <button className="btn btn-ghost" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => setViewDoc({ id: d.id, name: d.name })}>{t('Ver', 'View')}</button>
                    : <span className="mono" style={{ fontSize: 10.5, color: 'var(--ink-400)' }}>{t('sin archivo', 'no file')}</span>}
                </div>
              </div>
            ))}
            {!sel.documents?.length && <span style={{ fontSize: 12.5, color: 'var(--ink-500)' }}>{t('Solicitud de demostración (sin documentos)', 'Demo application (no documents)')}</span>}
          </div>

          <div className="eyebrow" style={{ marginBottom: 8 }}>{t('Términos de servicio', 'Terms of service')}</div>
          <div style={{ marginBottom: 16 }}>
            {sel.terms?.acceptedAt ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontSize: 13 }}>
                <span className="badge badge-brand">{t('Aceptados', 'Accepted')}</span>
                {sel.terms.version && <span className="mono" style={{ fontSize: 11, color: 'var(--ink-500)' }}>v{sel.terms.version}</span>}
                <span className="mono" style={{ fontSize: 11, color: 'var(--ink-500)' }}>{new Date(sel.terms.acceptedAt).toLocaleString()}</span>
              </div>
            ) : (
              <span className="badge badge-amber">{t('No registrados', 'Not recorded')}</span>
            )}
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
      {viewDoc && <DocViewer docId={viewDoc.id} name={viewDoc.name} onClose={() => setViewDoc(null)} />}
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

// ── driver delivery breakdown (map dot / driver row detail) ─────
function StatTile({ label, value, accent }: { label: string; value: number | string; accent: string }) {
  return (
    <div className="card" style={{ padding: '12px 14px' }}>
      <div className="eyebrow">{label}</div>
      <div className="display" style={{ fontSize: 26, margin: '4px 0 0', color: accent }}>{value}</div>
    </div>
  );
}

function DriverStatsPanel({ driverId, name, sub, role, onClose, onSaved }: { driverId: string; name?: string; sub?: string; role?: string; onClose: () => void; onSaved?: () => void }) {
  const { t } = useI18n();
  const [stats, setStats] = useState<{ assigned: number; delivered: number; pending: number; failed: number } | null>(null);
  const [docs, setDocs] = useState<Awaited<ReturnType<typeof api.driverDocuments>> | null>(null);
  const [dayStats, setDayStats] = useState<any>(null);
  const [err, setErr] = useState(false);
  const [viewDoc, setViewDoc] = useState<{ id: string; name: string } | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [reload, setReload] = useState(0);
  const canEdit = role === 'admin' || role === 'security_officer';

  useEffect(() => {
    let live = true;
    setStats(null); setDocs(null); setDayStats(null); setErr(false); setViewDoc(null);
    api.driverStats(driverId).then((s) => live && setStats(s)).catch(() => live && setErr(true));
    api.driverDocuments(driverId).then((d) => live && setDocs(d)).catch(() => {});
    api.driverDayStats(driverId).then((d) => live && setDayStats(d)).catch(() => {});
    return () => { live = false; };
  }, [driverId, reload]);

  const docBadge = (s: string) => s === 'approved' ? 'badge-brand' : s === 'rejected' || s === 'expired' ? 'badge-red' : 'badge-gray';

  return (
    <div className="card" style={{ width: 320, maxWidth: '100%', flexShrink: 0, padding: 18, position: 'sticky', top: 0, maxHeight: '88vh', overflowY: 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span className="eyebrow">{t('Conductor', 'Driver')}</span>
        <button onClick={onClose} className="btn btn-ghost" style={{ padding: '4px 10px' }}>✕</button>
      </div>
      {name && <div style={{ fontWeight: 600, fontSize: 15.5, marginTop: 6 }}>{name}</div>}
      {sub && <div className="mono" style={{ fontSize: 11.5, color: 'var(--ink-500)' }}>{sub}</div>}
      {canEdit && (
        <button className="btn btn-ghost" style={{ marginTop: 8, padding: '5px 12px', fontSize: 12.5 }} onClick={() => setEditOpen(true)}>
          ✎ {t('Editar datos', 'Edit driver')}
        </button>
      )}
      {docs?.driver?.phone && (
        <div style={{ marginTop: 6, fontSize: 13 }}>
          <span style={{ color: 'var(--ink-500)' }}>{t('Teléfono', 'Phone')}: </span>
          <a className="mono" href={`tel:${docs.driver.phone}`} style={{ color: 'var(--brand-ink)', textDecoration: 'none' }}>{docs.driver.phone}</a>
        </div>
      )}
      {docs?.driver?.address && (
        <div style={{ marginTop: 4, fontSize: 13 }}>
          <span style={{ color: 'var(--ink-500)' }}>{t('Dirección', 'Address')}: </span>
          <span>{docs.driver.address}</span>
        </div>
      )}

      <div className="eyebrow" style={{ margin: '16px 0 8px' }}>{t('Entregas', 'Deliveries')}</div>
      {err && <div className="badge badge-red">{t('No se pudo cargar', 'Failed to load')}</div>}
      {!stats && !err && <div style={{ color: 'var(--ink-500)', fontSize: 13 }}>…</div>}
      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <StatTile label={t('Asignados', 'Assigned')} value={stats.assigned} accent="var(--ink-900)" />
          <StatTile label={t('Entregados', 'Delivered')} value={stats.delivered} accent="var(--brand-ink)" />
          <StatTile label={t('Pendientes', 'Pending')} value={stats.pending} accent="var(--blue-ink)" />
          <StatTile label={t('Fallidos', 'Failed')} value={stats.failed} accent="var(--red-ink)" />
        </div>
      )}

      <div className="eyebrow" style={{ margin: '16px 0 8px' }}>{t('Desempeño (hojas del día)', 'Performance (day sheets)')}</div>
      {!dayStats && <div style={{ color: 'var(--ink-500)', fontSize: 13 }}>…</div>}
      {dayStats && (dayStats.days === 0
        ? <div style={{ fontSize: 12.5, color: 'var(--ink-500)' }}>{t('Sin hojas del día todavía.', 'No day sheets yet.')}</div>
        : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <StatTile label={t('Éxito entrega', 'Delivery success')} value={dayStats.successRate != null ? `${dayStats.successRate}%` : '—'} accent="var(--brand-ink)" />
            <StatTile label={t('Entregados', 'Delivered')} value={dayStats.successfulDeliveries} accent="var(--ink-900)" />
            <StatTile label={t('Devueltos', 'Returned')} value={dayStats.packagesReturned} accent="var(--red-ink)" />
            <StatTile label={t('Millaje total', 'Total mileage')} value={dayStats.mileage} accent="var(--blue-ink)" />
          </div>
        ))}

      <div className="eyebrow" style={{ margin: '16px 0 8px' }}>{t('Documentos', 'Documents')}</div>
      <div style={{ display: 'grid', gap: 8 }}>
        {(docs?.documents || []).map((d) => (
          <div key={d.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, fontSize: 13 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.name}</div>
              {d.expiryDate && <div className="mono" style={{ fontSize: 11, color: 'var(--ink-500)' }}>{t('Vence', 'Expires')} {d.expiryDate}</div>}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
              <span className={`badge ${docBadge(d.status)}`}>{d.status}</span>
              {d.hasFile
                ? <button className="btn btn-ghost" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => setViewDoc({ id: d.id, name: d.name })}>{t('Ver', 'View')}</button>
                : <span className="mono" style={{ fontSize: 10.5, color: 'var(--ink-400)' }}>{t('sin archivo', 'no file')}</span>}
            </div>
          </div>
        ))}
        {docs && !docs.documents.length && <span style={{ fontSize: 12.5, color: 'var(--ink-500)' }}>{t('Sin documentos', 'No documents')}</span>}
      </div>

      <div className="eyebrow" style={{ margin: '16px 0 8px' }}>{t('Términos de servicio', 'Terms of service')}</div>
      {docs?.terms?.acceptedAt ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontSize: 13 }}>
          <span className="badge badge-brand">{t('Aceptados', 'Accepted')}</span>
          {docs.terms.version && <span className="mono" style={{ fontSize: 11, color: 'var(--ink-500)' }}>v{docs.terms.version}</span>}
          <span className="mono" style={{ fontSize: 11, color: 'var(--ink-500)' }}>{new Date(docs.terms.acceptedAt).toLocaleString()}</span>
        </div>
      ) : (
        <span className="badge badge-amber">{t('No registrados', 'Not recorded')}</span>
      )}

      {viewDoc && <DocViewer docId={viewDoc.id} name={viewDoc.name} onClose={() => setViewDoc(null)} />}
      {editOpen && (
        <DriverEditModal driverId={driverId} onClose={() => setEditOpen(false)}
          onSaved={() => { setEditOpen(false); setReload((x) => x + 1); onSaved?.(); }} />
      )}
    </div>
  );
}

const VEHICLE_TYPES = ['moto', 'carro', 'van', 'camioneta', 'bici'];
const DRIVER_STATUSES = ['idle', 'enroute', 'delivering', 'offduty'];
const WEEKDAYS: [number, string, string][] = [
  [0, 'Sun', 'Dom'], [1, 'Mon', 'Lun'], [2, 'Tue', 'Mar'], [3, 'Wed', 'Mié'],
  [4, 'Thu', 'Jue'], [5, 'Fri', 'Vie'], [6, 'Sat', 'Sáb'],
];
const BLOCKS: [string, string, string][] = [
  ['madrugada', 'Early', 'Madrugada'], ['manana', 'Morning', 'Mañana'],
  ['tarde', 'Afternoon', 'Tarde'], ['noche', 'Night', 'Noche'],
];

// Ops driver-record editor (admin + security officer). Loads the full record,
// edits contact/vehicle/availability/identity and security flags, then saves.
function DriverEditModal({ driverId, onClose, onSaved }: { driverId: string; onClose: () => void; onSaved: () => void }) {
  const { t, lang } = useI18n();
  const [f, setF] = useState<any>(null);
  const [zones, setZones] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    api.getDriver(driverId).then((d) => { if (live) setF({ ...d, vehicle: d.vehicle || {}, zones: d.zones || [], days: d.days || [], blocks: d.blocks || [] }); }).catch((e) => setErr(e.message));
    api.zones().then((z) => live && setZones(z)).catch(() => {});
    return () => { live = false; };
  }, [driverId]);

  const setV = (k: string, v: any) => setF((p: any) => ({ ...p, vehicle: { ...p.vehicle, [k]: v } }));
  const toggle = (key: 'zones' | 'days' | 'blocks', v: any) => setF((p: any) => {
    const arr = p[key] || [];
    return { ...p, [key]: arr.includes(v) ? arr.filter((x: any) => x !== v) : [...arr, v] };
  });

  const save = async () => {
    setSaving(true); setErr(null);
    try {
      await api.updateDriver(driverId, {
        name: f.name, email: f.email, phone: f.phone, address: f.address, cedula: f.cedula,
        vehicle: f.vehicle, zones: f.zones, days: f.days, blocks: f.blocks,
        securityCleared: f.securityCleared, eligible: f.eligible, status: f.status,
      });
      onSaved();
    } catch (e: any) { setErr(e.message); } finally { setSaving(false); }
  };

  const chip = (on: boolean, label: string, onClick: () => void, key: string) => (
    <button key={key} onClick={onClick} className={`badge ${on ? 'badge-brand' : 'badge-gray'}`}
      style={{ cursor: 'pointer', border: 'none' }}>{label}</button>
  );

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', display: 'grid', placeItems: 'center', zIndex: 50, padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} className="card" style={{ width: 460, maxWidth: '100%', maxHeight: '90vh', overflowY: 'auto', padding: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <span className="eyebrow">{t('Editar conductor', 'Edit driver')}</span>
          <button onClick={onClose} className="btn btn-ghost" style={{ padding: '4px 10px' }}>✕</button>
        </div>
        {!f && !err && <div style={{ color: 'var(--ink-500)', padding: 20 }}>…</div>}
        {f && (<>
          <EField label={t('Nombre completo', 'Full name')}><input className="input" value={f.name || ''} onChange={(e) => setF({ ...f, name: e.target.value })} /></EField>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <EField label={t('Celular (usuario)', 'Mobile (username)')}><input className="input mono" value={f.phone || ''} onChange={(e) => setF({ ...f, phone: e.target.value })} /></EField>
            <EField label={t('Correo', 'Email')}><input className="input" value={f.email || ''} onChange={(e) => setF({ ...f, email: e.target.value })} /></EField>
          </div>
          <EField label={t('Documento nacional', 'National ID')}><input className="input mono" value={f.cedula || ''} onChange={(e) => setF({ ...f, cedula: e.target.value })} /></EField>
          <EField label={t('Dirección', 'Address')}><input className="input" value={f.address || ''} onChange={(e) => setF({ ...f, address: e.target.value })} /></EField>

          <div className="eyebrow" style={{ margin: '14px 0 8px' }}>{t('Vehículo', 'Vehicle')}</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <EField label={t('Tipo', 'Type')}>
              <select className="input" value={f.vehicle?.type || ''} onChange={(e) => setV('type', e.target.value)}>
                <option value="">—</option>
                {VEHICLE_TYPES.map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
            </EField>
            <EField label={t('Placa', 'Plate')}><input className="input mono" style={{ textTransform: 'uppercase' }} value={f.vehicle?.plate || ''} onChange={(e) => setV('plate', e.target.value)} /></EField>
            <EField label={t('Marca', 'Make')}><input className="input" value={f.vehicle?.brand || ''} onChange={(e) => setV('brand', e.target.value)} /></EField>
            <EField label={t('Modelo', 'Model')}><input className="input" value={f.vehicle?.model || ''} onChange={(e) => setV('model', e.target.value)} /></EField>
            <EField label={t('Año', 'Year')}><input className="input mono" value={f.vehicle?.year || ''} onChange={(e) => setV('year', e.target.value)} /></EField>
            <EField label={t('Color', 'Color')}><input className="input" value={f.vehicle?.color || ''} onChange={(e) => setV('color', e.target.value)} /></EField>
          </div>

          <div className="eyebrow" style={{ margin: '14px 0 8px' }}>{t('Zonas de operación', 'Operating zones')}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {zones.map((z) => chip((f.zones || []).includes(z.slug), lang === 'es' ? z.nameEs : z.nameEn, () => toggle('zones', z.slug), z.slug))}
          </div>

          <div className="eyebrow" style={{ margin: '14px 0 8px' }}>{t('Días disponibles', 'Available days')}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {WEEKDAYS.map(([n, en, es]) => chip((f.days || []).includes(n), lang === 'es' ? es : en, () => toggle('days', n), String(n)))}
          </div>
          <div className="eyebrow" style={{ margin: '14px 0 8px' }}>{t('Franjas horarias', 'Time blocks')}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {BLOCKS.map(([id, en, es]) => chip((f.blocks || []).includes(id), lang === 'es' ? es : en, () => toggle('blocks', id), id))}
          </div>

          <div className="eyebrow" style={{ margin: '14px 0 8px' }}>{t('Estado y seguridad', 'Status & security')}</div>
          <EField label={t('Estado', 'Status')}>
            <select className="input" value={f.status || ''} onChange={(e) => setF({ ...f, status: e.target.value })}>
              {DRIVER_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </EField>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, marginTop: 8 }}>
            <input type="checkbox" checked={!!f.securityCleared} onChange={(e) => setF({ ...f, securityCleared: e.target.checked })} />
            {t('Verificación de seguridad aprobada', 'Security cleared')}
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, marginTop: 6 }}>
            <input type="checkbox" checked={!!f.eligible} onChange={(e) => setF({ ...f, eligible: e.target.checked })} />
            {t('Elegible para recibir entregas', 'Eligible for deliveries')}
          </label>

          {err && <div className="badge badge-red" style={{ marginTop: 12 }}>{err}</div>}
          <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
            <button className="btn btn-ghost" style={{ flex: 1 }} onClick={onClose}>{t('Cancelar', 'Cancel')}</button>
            <button className="btn btn-primary" style={{ flex: 1 }} disabled={saving} onClick={save}>{saving ? '…' : t('Guardar', 'Save')}</button>
          </div>
        </>)}
        {err && !f && <div className="badge badge-red" style={{ marginTop: 12 }}>{err}</div>}
      </div>
    </div>
  );
}

function EField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label style={{ display: 'block', marginTop: 10 }}>
      <div style={{ fontSize: 11.5, color: 'var(--ink-500)', marginBottom: 4 }}>{label}</div>
      {children}
    </label>
  );
}

// Document review queue (admin + security officer): approve/reject the
// documents drivers upload after onboarding; rejection notifies over WhatsApp.
function DocumentReviews({ onChanged }: { onChanged: () => void }) {
  const { t, lang } = useI18n();
  const [rows, setRows] = useState<any[] | null>(null);
  const [viewDoc, setViewDoc] = useState<{ id: string; name: string } | null>(null);
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState('');
  const [toast, setToast] = useState<string | null>(null);
  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(null), 3200); };
  const load = () => api.documentReviews().then(setRows).catch(() => setRows([]));

  useRoom('ops');
  useEffect(() => { load(); }, []);
  useEvent('document.pending', useCallback(() => load(), []));

  const approve = async (r: any) => {
    setBusy(r.id);
    try { await api.approveDocument(r.id); flash(t('Documento aprobado', 'Document approved')); await load(); onChanged(); }
    catch (e: any) { flash(e.message); } finally { setBusy(''); }
  };
  const doReject = async (r: any) => {
    if (!reason.trim()) return;
    setBusy(r.id);
    try {
      const res = await api.rejectDocument(r.id, reason.trim());
      flash(res.whatsappNotified
        ? t('Rechazado · conductor notificado por WhatsApp', 'Rejected · driver notified via WhatsApp')
        : t('Rechazado (WhatsApp no enviado)', 'Rejected (WhatsApp not sent)'));
      setRejecting(null); setReason(''); await load(); onChanged();
    } catch (e: any) { flash(e.message); } finally { setBusy(''); }
  };

  return (
    <div style={{ maxWidth: 760 }}>
      <div style={{ fontSize: 13, color: 'var(--ink-500)', marginBottom: 14 }}>
        {t('Documentos subidos por conductores que esperan revisión.', 'Driver-uploaded documents awaiting review.')}
      </div>
      {!rows && <div style={{ color: 'var(--ink-500)' }}>…</div>}
      {rows && !rows.length && <div className="card" style={{ padding: 24, textAlign: 'center', color: 'var(--ink-500)' }}>{t('No hay documentos pendientes.', 'No documents pending review.')}</div>}
      <div style={{ display: 'grid', gap: 12 }}>
        {(rows || []).map((r) => (
          <div key={r.id} className="card" style={{ padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 15 }}>{lang === 'es' ? r.docNameEs : r.docName}{r.required && <span style={{ color: 'var(--brand-ink)' }}> *</span>}</div>
                <div className="mono" style={{ fontSize: 12, color: 'var(--ink-500)' }}>{r.driverName || r.driverId}{r.phone ? ` · ${r.phone}` : ''}</div>
                <div className="mono" style={{ fontSize: 11, color: 'var(--ink-400)' }}>
                  {t('Subido', 'Uploaded')} {new Date(r.uploadedAt).toLocaleString()}{r.expiryDate ? ` · ${t('vence', 'exp')} ${r.expiryDate}` : ''}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                {r.hasFile && <button className="btn btn-ghost" style={{ padding: '5px 12px', fontSize: 12.5 }} onClick={() => setViewDoc({ id: r.id, name: r.docName })}>{t('Ver', 'View')}</button>}
                <button className="btn btn-primary" style={{ padding: '5px 12px', fontSize: 12.5 }} disabled={busy === r.id} onClick={() => approve(r)}>{t('Aprobar', 'Approve')}</button>
                <button className="btn btn-ghost" style={{ padding: '5px 12px', fontSize: 12.5, color: 'var(--red-ink, #d9342b)' }} disabled={busy === r.id} onClick={() => { setRejecting(rejecting === r.id ? null : r.id); setReason(''); }}>{t('Rechazar', 'Reject')}</button>
              </div>
            </div>
            {rejecting === r.id && (
              <div style={{ marginTop: 12, display: 'grid', gap: 8 }}>
                <textarea className="input" rows={2} placeholder={t('Motivo del rechazo (se envía al conductor por WhatsApp)', 'Rejection reason (sent to the driver via WhatsApp)')}
                  value={reason} onChange={(e) => setReason(e.target.value)} />
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button className="btn btn-ghost" style={{ padding: '5px 12px', fontSize: 12.5 }} onClick={() => { setRejecting(null); setReason(''); }}>{t('Cancelar', 'Cancel')}</button>
                  <button className="btn btn-primary" style={{ padding: '5px 12px', fontSize: 12.5, background: 'var(--red-ink, #d9342b)' }} disabled={!reason.trim() || busy === r.id} onClick={() => doReject(r)}>{t('Confirmar rechazo', 'Confirm rejection')}</button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
      {viewDoc && <DocViewer docId={viewDoc.id} name={viewDoc.name} onClose={() => setViewDoc(null)} />}
      {toast && <div style={{ position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)', background: 'var(--ink-900)', color: '#fff', padding: '10px 16px', borderRadius: 10, fontSize: 13, zIndex: 60, boxShadow: 'var(--shadow-lg)' }}>{toast}</div>}
    </div>
  );
}

// Barbados road network (from "Barbados Roads.kmz"), projected with the same
// box as toXY. Lazy-loaded so it doesn't weigh down the initial bundle.
function RoadsLayer() {
  const [roads, setRoads] = useState<{ major: string; medium: string; minor: string; vb: number } | null>(null);
  useEffect(() => {
    let live = true;
    import('./assets/barbados-roads')
      .then((m) => { if (live) setRoads({ ...m.ROADS, vb: m.ROADS_VIEWBOX }); })
      .catch(() => {});
    return () => { live = false; };
  }, []);
  if (!roads) return null;
  const line = (d: string, stroke: string, w: number, o = 1) => (
    <path d={d} fill="none" stroke={stroke} strokeWidth={w} opacity={o}
      vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" />
  );
  return (
    <svg viewBox={`0 0 ${roads.vb} ${roads.vb}`} preserveAspectRatio="none"
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }} aria-hidden>
      {line(roads.minor, 'var(--ink-400, #9fb0b8)', 0.5, 0.5)}
      {line(roads.medium, 'var(--ink-500, #6b7d86)', 0.9, 0.75)}
      {line(roads.major, 'var(--ink-700, #45555d)', 1.5, 0.9)}
    </svg>
  );
}

function LiveMap({ role }: { role?: string }) {
  const { t } = useI18n();
  const [drivers, setDrivers] = useState<Record<string, any>>({});
  const [selected, setSelected] = useState<string | null>(null);
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
      <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div className="card" style={{ position: 'relative', width: 'min(100%, 460px)', aspectRatio: MAP_ASPECT, overflow: 'hidden', background: 'var(--surface-2, #eef3f5)' }}>
          <RoadsLayer />
          {list.map((d: any) => {
            const { x, y } = toXY(d.lng, d.lat);
            const on = selected === d.id;
            return (
              <button key={d.id} onClick={() => setSelected(on ? null : d.id)} title={d.name}
                style={{ position: 'absolute', left: `${x}%`, top: `${y}%`, transform: 'translate(-50%,-50%)',
                  transition: 'left 1.2s linear, top 1.2s linear', background: 'none', border: 'none', padding: 0, cursor: 'pointer', zIndex: on ? 5 : 1 }}>
                <div style={{ width: on ? 18 : 14, height: on ? 18 : 14, borderRadius: 99, background: tierColor[d.tier] || 'var(--ink-500)',
                  border: on ? '3px solid var(--ink-900)' : '2px solid #fff', boxShadow: on ? '0 0 0 3px var(--brand-tint)' : 'var(--shadow)' }} />
                {d.name && <div className="mono" style={{ fontSize: 10, marginTop: 2, color: 'var(--ink-700)', whiteSpace: 'nowrap', transform: 'translateX(-50%)', marginLeft: 7 }}>{d.name.split(' ')[0]}</div>}
              </button>
            );
          })}
          {!list.length && <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: 'var(--ink-500)' }}>{t('Sin conductores activos', 'No active drivers')}</div>}
        </div>
        {selected && drivers[selected] && (
          <DriverStatsPanel driverId={selected} name={drivers[selected].name}
            sub={[drivers[selected].vehicle, drivers[selected].tier].filter(Boolean).join(' · ')}
            role={role} onClose={() => setSelected(null)} />
        )}
      </div>
    </div>
  );
}

function Drivers({ role }: { role?: string }) {
  const { t } = useI18n();
  const [rows, setRows] = useState<any[]>([]);
  const [sel, setSel] = useState<any>(null);
  const loadDrivers = useCallback(() => { api.drivers().then(setRows).catch(() => {}); }, []);
  useEffect(() => { loadDrivers(); }, [loadDrivers]);
  return (
    <div style={{ display: 'flex', gap: 18, alignItems: 'flex-start', flexWrap: 'wrap' }}>
      <div className="card" style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
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
              <tr key={d.id} onClick={() => setSel(d)}
                style={{ borderTop: '1px solid var(--line)', cursor: 'pointer',
                  background: sel?.id === d.id ? 'var(--brand-tint)' : undefined }}>
                <td style={{ padding: '12px 16px', fontWeight: 600 }}>{d.name}
                  <div className="mono" style={{ fontSize: 11, color: 'var(--ink-500)', fontWeight: 400 }}>{d.plate}{d.phone ? ` · ${d.phone}` : ''}</div>
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
      {sel && (
        <DriverStatsPanel driverId={sel.id} name={sel.name}
          sub={[sel.plate, sel.vehicle, sel.tier].filter(Boolean).join(' · ')}
          role={role} onClose={() => setSel(null)} onSaved={loadDrivers} />
      )}
    </div>
  );
}

// ── root ────────────────────────────────────────────────────────
export function App() {
  const [lang, setLang] = useState<Lang>('en');
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
