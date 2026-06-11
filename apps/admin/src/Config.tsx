import { useEffect, useState } from 'react';
import { api } from './lib/api';
import { useI18n } from './lib/i18n';

const SECTIONS = [
  ['doctypes', 'Tipos de documento', 'Document types'],
  ['workflow', 'Flujo de aprobación', 'Approval workflow'],
  ['scoring', 'Puntaje y niveles', 'Scoring & tiers'],
  ['templates', 'Plantillas', 'Templates'],
  ['zones', 'Zonas', 'Zones'],
] as const;

const ROLES = ['dispatcher', 'security_officer', 'admin'];

export function Config() {
  const { t } = useI18n();
  const [sec, setSec] = useState<string>('doctypes');
  return (
    <div style={{ display: 'flex', gap: 18, alignItems: 'flex-start' }}>
      <div style={{ width: 210, flexShrink: 0, display: 'grid', gap: 4 }}>
        {SECTIONS.map(([id, es, en]) => (
          <button key={id} onClick={() => setSec(id)} style={{ textAlign: 'left', border: '1px solid ' + (sec === id ? 'var(--brand)' : 'var(--line)'), background: sec === id ? 'var(--brand-tint)' : 'var(--surface)', color: sec === id ? 'var(--brand-ink)' : 'var(--ink-700)', borderRadius: 10, padding: '10px 12px', fontSize: 13.5, fontWeight: 600 }}>{t(es, en)}</button>
        ))}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        {sec === 'doctypes' && <DocTypes />}
        {sec === 'workflow' && <Workflow />}
        {sec === 'scoring' && <Scoring />}
        {sec === 'templates' && <Templates />}
        {sec === 'zones' && <Zones />}
      </div>
    </div>
  );
}

function Saved({ on }: { on: boolean }) {
  const { t } = useI18n();
  return on ? <span className="badge badge-brand" style={{ marginLeft: 8 }}>{t('Guardado', 'Saved')}</span> : null;
}

function DocTypes() {
  const { t } = useI18n();
  const [rows, setRows] = useState<any[]>([]);
  const [saved, setSaved] = useState('');
  const [nw, setNw] = useState<any>({ key: '', nameEs: '', nameEn: '', required: true, tracksExpiry: false });
  const load = () => api.cfgDocTypes().then(setRows);
  useEffect(() => { load(); }, []);

  const save = async (d: any) => {
    await api.cfgUpdateDocType(d.id, { nameEs: d.nameEs, nameEn: d.nameEn, required: d.required, tracksExpiry: d.tracksExpiry, reminderOffsets: d.reminderOffsets, active: d.active });
    setSaved(d.id); setTimeout(() => setSaved(''), 1500);
  };
  const add = async () => { await api.cfgCreateDocType(nw); setNw({ key: '', nameEs: '', nameEn: '', required: true, tracksExpiry: false }); load(); };

  return (
    <div className="card" style={{ padding: 18 }}>
      <div className="eyebrow" style={{ marginBottom: 12 }}>{t('Tipos de documento (el formulario de onboarding se genera de aquí)', 'Document types (onboarding form renders from this)')}</div>
      <div style={{ display: 'grid', gap: 10 }}>
        {rows.map((d, i) => (
          <div key={d.id} style={{ display: 'grid', gridTemplateColumns: '90px 1fr 1fr auto auto auto auto', gap: 8, alignItems: 'center', padding: 10, borderRadius: 10, background: d.active ? 'var(--surface)' : 'var(--surface-2)', border: '1px solid var(--line)' }}>
            <span className="mono" style={{ fontSize: 12 }}>{d.key}</span>
            <input className="input" value={d.nameEs} onChange={(e) => setRows((r) => r.map((x, j) => j === i ? { ...x, nameEs: e.target.value } : x))} />
            <input className="input" value={d.nameEn} onChange={(e) => setRows((r) => r.map((x, j) => j === i ? { ...x, nameEn: e.target.value } : x))} />
            <label style={{ fontSize: 12, display: 'flex', gap: 4, alignItems: 'center' }}><input type="checkbox" checked={d.required} onChange={(e) => setRows((r) => r.map((x, j) => j === i ? { ...x, required: e.target.checked } : x))} />req</label>
            <label style={{ fontSize: 12, display: 'flex', gap: 4, alignItems: 'center' }}><input type="checkbox" checked={d.tracksExpiry} onChange={(e) => setRows((r) => r.map((x, j) => j === i ? { ...x, tracksExpiry: e.target.checked } : x))} />exp</label>
            <label style={{ fontSize: 12, display: 'flex', gap: 4, alignItems: 'center' }}><input type="checkbox" checked={d.active} onChange={(e) => setRows((r) => r.map((x, j) => j === i ? { ...x, active: e.target.checked } : x))} />on</label>
            <button className="btn btn-ghost" style={{ padding: '6px 12px' }} onClick={() => save(d)}>{t('Guardar', 'Save')}<Saved on={saved === d.id} /></button>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--line)', display: 'grid', gridTemplateColumns: '90px 1fr 1fr auto', gap: 8 }}>
        <input className="input mono" placeholder="key" value={nw.key} onChange={(e) => setNw({ ...nw, key: e.target.value })} />
        <input className="input" placeholder="Nombre ES" value={nw.nameEs} onChange={(e) => setNw({ ...nw, nameEs: e.target.value })} />
        <input className="input" placeholder="Name EN" value={nw.nameEn} onChange={(e) => setNw({ ...nw, nameEn: e.target.value })} />
        <button className="btn btn-dark" disabled={!nw.key || !nw.nameEs} onClick={add}>{t('Añadir', 'Add')}</button>
      </div>
    </div>
  );
}

function Workflow() {
  const { t, lang } = useI18n();
  const [wf, setWf] = useState<any>(null);
  const load = () => api.cfgWorkflow().then(setWf);
  useEffect(() => { load(); }, []);
  if (!wf) return <div className="card" style={{ padding: 18, color: 'var(--ink-500)' }}>…</div>;

  const move = async (i: number, dir: number) => {
    const s = [...wf.stages];
    const j = i + dir;
    if (j < 0 || j >= s.length) return;
    [s[i], s[j]] = [s[j], s[i]];
    await api.cfgReorder(s.map((x: any) => x.id));
    load();
  };
  const update = async (id: string, b: any) => { await api.cfgUpdateStage(id, b); load(); };

  return (
    <div className="card" style={{ padding: 18 }}>
      <div className="eyebrow" style={{ marginBottom: 12 }}>{t('Etapas (reordena, cambia rol/modo, marca seguridad)', 'Stages (reorder, change role/mode, mark security)')}</div>
      <div style={{ display: 'grid', gap: 10 }}>
        {wf.stages.map((s: any, i: number) => (
          <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 12, borderRadius: 10, border: '1px solid var(--line)' }}>
            <div style={{ display: 'grid' }}>
              <button className="btn btn-ghost" style={{ padding: '2px 8px' }} onClick={() => move(i, -1)}>▲</button>
              <button className="btn btn-ghost" style={{ padding: '2px 8px', marginTop: 2 }} onClick={() => move(i, 1)}>▼</button>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600 }}>{lang === 'es' ? s.nameEs : s.nameEn}</div>
              <div style={{ display: 'flex', gap: 8, marginTop: 6, alignItems: 'center' }}>
                <select className="select" style={{ width: 'auto', padding: '6px 8px' }} value={s.mode} onChange={(e) => update(s.id, { mode: e.target.value })}>
                  <option value="manual">manual</option><option value="automatic">automatic</option>
                </select>
                <select className="select" style={{ width: 'auto', padding: '6px 8px' }} value={s.responsibleRole} onChange={(e) => update(s.id, { responsibleRole: e.target.value })}>
                  {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
                <label style={{ fontSize: 12.5, display: 'flex', gap: 5, alignItems: 'center' }}>
                  <input type="checkbox" checked={s.isSecurityClearance} onChange={(e) => update(s.id, { isSecurityClearance: e.target.checked })} />{t('seguridad', 'security')}
                </label>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Scoring() {
  const { t } = useI18n();
  const [cfg, setCfg] = useState<any>(null);
  const [saved, setSaved] = useState(false);
  useEffect(() => { api.scoringConfig().then(setCfg); }, []);
  if (!cfg) return <div className="card" style={{ padding: 18, color: 'var(--ink-500)' }}>…</div>;

  const W = ['rating', 'completion', 'acceptance', 'onTime', 'recency'];
  const save = async () => { await api.scoringUpdate({ weights: cfg.weights, tiers: cfg.tiers }); setSaved(true); setTimeout(() => setSaved(false), 1500); };
  const sum = W.reduce((a, k) => a + Number(cfg.weights[k] || 0), 0);

  return (
    <div className="card" style={{ padding: 18 }}>
      <div className="eyebrow" style={{ marginBottom: 12 }}>{t('Pesos del puntaje (recalcula a todos al guardar)', 'Score weights (recomputes everyone on save)')}</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 10, marginBottom: 8 }}>
        {W.map((k) => (
          <div key={k}>
            <label className="field-label" style={{ textTransform: 'capitalize' }}>{k}</label>
            <input className="input mono" type="number" step="0.05" value={cfg.weights[k]} onChange={(e) => setCfg({ ...cfg, weights: { ...cfg.weights, [k]: Number(e.target.value) } })} />
          </div>
        ))}
      </div>
      <div style={{ fontSize: 12.5, color: sum.toFixed(2) === '1.00' ? 'var(--brand-ink)' : 'var(--amber-ink)', marginBottom: 16 }}>{t('Suma', 'Sum')}: {sum.toFixed(2)} {sum.toFixed(2) !== '1.00' && t('(debe ser 1.00)', '(should be 1.00)')}</div>

      <div className="eyebrow" style={{ marginBottom: 10 }}>{t('Umbrales de nivel', 'Tier thresholds')}</div>
      <div style={{ display: 'grid', gap: 8, marginBottom: 16 }}>
        {cfg.tiers.map((th: any, i: number) => (
          <div key={th.tier} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span className="badge badge-gray" style={{ width: 110, justifyContent: 'center' }}>{th.tier}</span>
            <span style={{ fontSize: 13, color: 'var(--ink-500)' }}>≥</span>
            <input className="input mono" style={{ width: 90 }} type="number" value={th.min} onChange={(e) => setCfg({ ...cfg, tiers: cfg.tiers.map((x: any, j: number) => j === i ? { ...x, min: Number(e.target.value) } : x) })} />
          </div>
        ))}
      </div>
      <button className="btn btn-primary" onClick={save}>{t('Guardar y recalcular', 'Save & recompute')}<Saved on={saved} /></button>
    </div>
  );
}

function Templates() {
  const { t } = useI18n();
  const [rows, setRows] = useState<any[]>([]);
  const [saved, setSaved] = useState('');
  const load = () => api.cfgTemplates().then(setRows);
  useEffect(() => { load(); }, []);
  const save = async (tpl: any) => { await api.cfgUpdateTemplate(tpl.id, { subject: tpl.subject, body: tpl.body, active: tpl.active }); setSaved(tpl.id); setTimeout(() => setSaved(''), 1500); };

  return (
    <div className="card" style={{ padding: 18 }}>
      <div className="eyebrow" style={{ marginBottom: 12 }}>{t('Plantillas de notificación · {{variables}} · ES/EN', 'Notification templates · {{variables}} · ES/EN')}</div>
      <div style={{ display: 'grid', gap: 12 }}>
        {rows.map((tpl, i) => (
          <div key={tpl.id} style={{ padding: 12, borderRadius: 10, border: '1px solid var(--line)' }}>
            <div style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
              <span className="mono" style={{ fontSize: 12 }}>{tpl.key}</span>
              <span className="badge badge-gray">{tpl.channel}</span>
              <span className="badge badge-blue">{tpl.locale}</span>
            </div>
            <textarea className="textarea" rows={2} value={tpl.body} onChange={(e) => setRows((r) => r.map((x, j) => j === i ? { ...x, body: e.target.value } : x))} />
            <button className="btn btn-ghost" style={{ marginTop: 8, padding: '6px 12px' }} onClick={() => save(tpl)}>{t('Guardar', 'Save')}<Saved on={saved === tpl.id} /></button>
          </div>
        ))}
      </div>
    </div>
  );
}

function Zones() {
  const { t } = useI18n();
  const [rows, setRows] = useState<any[]>([]);
  const load = () => api.cfgAreas().then(setRows);
  useEffect(() => { load(); }, []);
  const toggle = async (z: any) => { await api.cfgUpdateArea(z.id, { active: !z.active }); load(); };

  return (
    <div className="card" style={{ padding: 18 }}>
      <div className="eyebrow" style={{ marginBottom: 12 }}>{t('Zonas operativas (PostGIS)', 'Operating areas (PostGIS)')}</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 8 }}>
        {rows.map((z) => (
          <div key={z.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', borderRadius: 9, border: '1px solid var(--line)' }}>
            <span>{z.nameEs}</span>
            <button className={`badge ${z.active ? 'badge-brand' : 'badge-gray'}`} style={{ cursor: 'pointer', border: 'none' }} onClick={() => toggle(z)}>{z.active ? t('activa', 'active') : t('inactiva', 'inactive')}</button>
          </div>
        ))}
      </div>
    </div>
  );
}
