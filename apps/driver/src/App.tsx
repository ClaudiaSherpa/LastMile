import { useEffect, useMemo, useRef, useState } from 'react';
import { api, DocType, session, Zone } from './lib/api';
import { I18nCtx, Lang, useI18n } from './lib/i18n';
import { Tracking } from './Tracking';

// ── static config (vehicle enum is fixed; capacity mirrors the backend) ──
const VEHICLES = [
  { id: 'moto', es: 'Motocicleta', en: 'Motorcycle', cap: 'Hasta 15 kg', capEn: 'Up to 15 kg' },
  { id: 'carro', es: 'Automóvil', en: 'Car', cap: 'Hasta 80 kg', capEn: 'Up to 80 kg' },
  { id: 'van', es: 'Van', en: 'Van', cap: 'Hasta 600 kg', capEn: 'Up to 600 kg' },
  { id: 'camioneta', es: 'Camioneta', en: 'Pickup', cap: 'Hasta 1.2 t', capEn: 'Up to 1.2 t' },
  { id: 'bici', es: 'Bicicleta', en: 'Bicycle', cap: 'Hasta 8 kg', capEn: 'Up to 8 kg' },
];
const DAYS = [['lun', 'Lun', 'Mon'], ['mar', 'Mar', 'Tue'], ['mie', 'Mié', 'Wed'], ['jue', 'Jue', 'Thu'], ['vie', 'Vie', 'Fri'], ['sab', 'Sáb', 'Sat'], ['dom', 'Dom', 'Sun']];
const BLOCKS = [['madrugada', 'Madrugada', 'Early', '00–06'], ['manana', 'Mañana', 'Morning', '06–12'], ['tarde', 'Tarde', 'Afternoon', '12–18'], ['noche', 'Noche', 'Night', '18–24']];

// ── frame + primitives ──────────────────────────────────────────
function Phone({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: 'var(--ink-900)' }}>
      <div style={{ position: 'fixed', inset: 0, opacity: 0.5, pointerEvents: 'none',
        background: 'radial-gradient(90% 60% at 70% -10%, oklch(0.45 0.11 168 / .55), transparent 60%)' }} />
      <div style={{ width: 390, maxWidth: '94vw', height: 'min(844px, 96vh)', borderRadius: 36, background: 'var(--paper)',
        color: 'var(--ink-900)', boxShadow: 'var(--shadow-lg)', overflow: 'hidden', position: 'relative', display: 'flex', flexDirection: 'column' }}>
        {children}
      </div>
    </div>
  );
}

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

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label className="field-label">{label}</label>
      {children}
      {hint && <div style={{ fontSize: 12, color: 'var(--ink-500)', marginTop: 5 }}>{hint}</div>}
    </div>
  );
}

function Toast({ msg }: { msg: string | null }) {
  if (!msg) return null;
  return (
    <div style={{ position: 'absolute', left: 16, right: 16, bottom: 90, zIndex: 20 }} className="fade-up">
      <div style={{ background: 'var(--ink-900)', color: '#fff', borderRadius: 12, padding: '12px 14px', fontSize: 13.5, boxShadow: 'var(--shadow-lg)' }}>{msg}</div>
    </div>
  );
}

// ── welcome ─────────────────────────────────────────────────────
function Welcome({ onStart }: { onStart: () => void }) {
  const { t } = useI18n();
  return (
    <Phone>
      <div style={{ padding: '54px 26px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <div style={{ width: 30, height: 30, borderRadius: 8, background: 'var(--brand)' }} />
          <span className="display" style={{ fontSize: 17, fontWeight: 600 }}>Sherpa<span style={{ color: 'var(--brand-600)' }}>LM</span></span>
        </div>
        <LangToggle />
      </div>
      <div style={{ padding: '40px 26px', flex: 1, display: 'flex', flexDirection: 'column' }}>
        <span className="eyebrow" style={{ color: 'var(--brand-ink)' }}>{t('Conductor', 'Driver')}</span>
        <h1 className="display" style={{ fontSize: 34, lineHeight: 1.08, margin: '12px 0 14px' }}>
          {t('Conduce con Sherpa en Bogotá.', 'Drive with Sherpa in Bogotá.')}
        </h1>
        <p style={{ fontSize: 15.5, lineHeight: 1.5, color: 'var(--ink-600)', margin: 0 }}>
          {t('Sube licencia, SOAT y tarjeta de propiedad — las leemos por ti con OCR y autocompletamos el formulario. Tras la revisión de seguridad empiezas a recibir fletes.',
             'Upload license, SOAT and registration — we read them with OCR and auto-fill the form. After security review you start receiving freight.')}
        </p>
        <div style={{ marginTop: 'auto' }}>
          <button className="btn btn-primary btn-lg btn-block" onClick={onStart}>{t('Comenzar solicitud', 'Start application')}</button>
        </div>
      </div>
    </Phone>
  );
}

// ── pending review ──────────────────────────────────────────────
function Pending({ app, onReset }: { app: any; onReset: () => void }) {
  const { t } = useI18n();
  return (
    <Phone>
      <div style={{ padding: '54px 26px 0', display: 'flex', justifyContent: 'flex-end' }}><LangToggle /></div>
      <div style={{ padding: '30px 26px', flex: 1, display: 'flex', flexDirection: 'column', textAlign: 'center', alignItems: 'center' }}>
        <div style={{ width: 88, height: 88, borderRadius: 24, background: 'var(--brand-tint)', display: 'grid', placeItems: 'center', margin: '20px 0 24px' }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: 'var(--brand)' }} />
        </div>
        <span className="eyebrow">{app.reference}</span>
        <h1 className="display" style={{ fontSize: 26, margin: '8px 0 10px' }}>{t('Solicitud enviada', 'Application submitted')}</h1>
        <p style={{ fontSize: 15, color: 'var(--ink-600)', lineHeight: 1.5, margin: 0 }}>
          {t('Tu solicitud está en revisión de seguridad. Te avisaremos cuando sea aprobada y puedas recibir fletes.',
             'Your application is under security review. We will notify you once it is approved and you can receive freight.')}
        </p>
        <div className="card" style={{ marginTop: 24, padding: 16, width: '100%', textAlign: 'left' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0' }}>
            <span style={{ color: 'var(--ink-500)', fontSize: 13.5 }}>{t('Estado', 'Status')}</span>
            <span className="badge badge-amber">{t('En revisión', 'In review')}</span>
          </div>
        </div>
        <button className="btn btn-ghost btn-block" style={{ marginTop: 'auto' }} onClick={onReset}>{t('Nueva solicitud', 'New application')}</button>
      </div>
    </Phone>
  );
}

// ── wizard ──────────────────────────────────────────────────────
const STEPS = 7;

function Wizard({ appId, token, initialDraft, onSubmitted, onExit }: {
  appId: string; token: string; initialDraft: any; onSubmitted: (app: any) => void; onExit: () => void;
}) {
  const { t, lang } = useI18n();
  const [step, setStep] = useState<number>(initialDraft?.step || 0);
  const [draft, setDraft] = useState<any>({ docs: {}, documents: {}, zones: [], days: [], blocks: [], ...initialDraft });
  const [docTypes, setDocTypes] = useState<DocType[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [uploading, setUploading] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const pendingDocKey = useRef<string>('');

  useEffect(() => { api.documentTypes().then(setDocTypes).catch(() => {}); api.operatingAreas().then(setZones).catch(() => {}); }, []);

  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(null), 3200); };
  const set = (patch: any) => setDraft((d: any) => ({ ...d, ...patch }));
  const toggleArr = (key: string, val: string) => {
    const arr: string[] = draft[key] || [];
    set({ [key]: arr.includes(val) ? arr.filter((v) => v !== val) : [...arr, val] });
  };

  const requiredDocs = docTypes.filter((d) => d.required);
  const allRequiredUploaded = requiredDocs.every((d) => draft.docs?.[d.key]);

  const canNext = () => {
    if (step === 0) return draft.name && draft.phone && draft.cedula;
    if (step === 1) return !!draft.vehicle;
    if (step === 2) return draft.plate && draft.brand && draft.year;
    if (step === 3) return allRequiredUploaded;
    if (step === 4) return (draft.zones || []).length > 0;
    if (step === 5) return (draft.days || []).length > 0 && (draft.blocks || []).length > 0;
    return true;
  };

  const persist = async (extra: any = {}) => {
    try { await api.patch(appId, token, { ...draft, ...extra, step }); } catch { /* offline tolerated */ }
  };

  const next = async () => {
    if (step < STEPS - 1) {
      const ns = step + 1;
      setStep(ns);
      try { await api.patch(appId, token, { ...draft, step: ns }); } catch { /* ignore */ }
    } else {
      setBusy(true);
      try {
        await persist();
        const res = await api.submit(appId, token);
        onSubmitted(res);
      } catch (e: any) {
        flash(e.message);
      } finally {
        setBusy(false);
      }
    }
  };
  const back = () => { if (step === 0) onExit(); else setStep(step - 1); };

  const pickFile = (docKey: string) => { pendingDocKey.current = docKey; fileInput.current?.click(); };
  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const docKey = pendingDocKey.current;
    setUploading(docKey);
    try {
      const res = await api.uploadDocument(appId, token, docKey, file);
      // merge server draft (includes OCR auto-fill) into local state
      setDraft((d: any) => ({ ...d, ...res.draft }));
      const applied = Object.keys(res.applied || {});
      if (res.ocr?.skipped) flash(t('Documento cargado.', 'Document uploaded.'));
      else if (applied.length) flash(t(`OCR autocompletó: ${applied.join(', ')}`, `OCR auto-filled: ${applied.join(', ')}`));
      else flash(t('Documento cargado · validando…', 'Document uploaded · validating…'));
    } catch (err: any) {
      flash(err.message);
    } finally {
      setUploading(null);
    }
  };

  const titles = [
    [t('Tus datos', 'Your details'), t('Creamos tu perfil de conductor', 'We create your driver profile')],
    [t('Tu vehículo', 'Your vehicle'), t('¿Con qué vas a repartir?', 'What will you deliver with?')],
    [t('Características', 'Vehicle specs'), t('Datos de tu vehículo', 'Details of your vehicle')],
    [t('Documentos', 'Documents'), t('Súbelos y los leemos con OCR', 'Upload them, we read with OCR')],
    [t('Zonas de operación', 'Operating zones'), t('¿Dónde quieres repartir?', 'Where do you want to operate?')],
    [t('Disponibilidad', 'Availability'), t('Tus días y horarios', 'Your days and hours')],
    [t('Revisa y envía', 'Review & submit'), t('Confirma tu solicitud', 'Confirm your application')],
  ];

  const chip = (active: boolean, label: string, onClick: () => void, key: string) => (
    <button key={key} onClick={onClick} style={{ border: '1px solid ' + (active ? 'var(--brand)' : 'var(--line)'),
      background: active ? 'var(--brand-tint)' : 'var(--surface)', color: active ? 'var(--brand-ink)' : 'var(--ink-700)',
      borderRadius: 999, padding: '8px 14px', fontSize: 13.5, fontWeight: 600 }}>{label}</button>
  );

  return (
    <Phone>
      <input ref={fileInput} type="file" accept="image/*,application/pdf" style={{ display: 'none' }} onChange={onFile} />
      {/* header */}
      <div style={{ paddingTop: 54 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 16px 12px' }}>
          <button onClick={back} style={{ width: 38, height: 38, borderRadius: 10, border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--ink-700)' }}>‹</button>
          <span className="mono" style={{ fontSize: 11, color: 'var(--ink-500)', letterSpacing: '.08em' }}>SHERPA LM</span>
          <LangToggle />
        </div>
        <div style={{ padding: '0 20px 14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
            <span className="eyebrow">{t('Paso', 'Step')} {step + 1} / {STEPS}</span>
            <span className="mono" style={{ fontSize: 11, color: 'var(--brand-ink)', fontWeight: 600 }}>{Math.round((step / STEPS) * 100)}%</span>
          </div>
          <div className="track"><span style={{ width: (step / STEPS) * 100 + '%' }} /></div>
        </div>
        <div style={{ padding: '0 20px 12px' }}>
          <h1 className="display" style={{ fontSize: 25, margin: '0 0 3px' }}>{titles[step][0]}</h1>
          <p style={{ margin: 0, fontSize: 14, color: 'var(--ink-500)' }}>{titles[step][1]}</p>
        </div>
      </div>

      {/* body */}
      <div className="scroll" key={step} style={{ flex: 1, overflowY: 'auto', padding: '4px 20px 20px' }}>
        <div className="fade-up">
          {step === 0 && (<>
            <Field label={t('Nombre completo', 'Full name')}><input className="input" value={draft.name || ''} onChange={(e) => set({ name: e.target.value })} placeholder="Juan Pérez" /></Field>
            <Field label={t('Cédula', 'National ID')}><input className="input mono" value={draft.cedula || ''} onChange={(e) => set({ cedula: e.target.value })} placeholder="1.0XX.XXX.XXX" /></Field>
            <Field label={t('Celular', 'Mobile')}><input className="input mono" value={draft.phone || ''} onChange={(e) => set({ phone: e.target.value })} placeholder="+57 3XX XXX XXXX" /></Field>
            <Field label={t('Correo (opcional)', 'Email (optional)')}><input className="input" value={draft.email || ''} onChange={(e) => set({ email: e.target.value })} placeholder="tu@correo.com" /></Field>
          </>)}

          {step === 1 && (
            <div style={{ display: 'grid', gap: 11 }}>
              {VEHICLES.map((v) => {
                const on = draft.vehicle === v.id;
                return (
                  <button key={v.id} onClick={() => set({ vehicle: v.id, capacity: lang === 'es' ? v.cap : v.capEn })}
                    style={{ display: 'flex', alignItems: 'center', gap: 14, padding: 14, borderRadius: 13, textAlign: 'left',
                      border: '1.5px solid ' + (on ? 'var(--brand)' : 'var(--line)'), background: on ? 'var(--brand-tint)' : 'var(--surface)' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: 16 }}>{lang === 'es' ? v.es : v.en}</div>
                      <div style={{ fontSize: 12.5, color: 'var(--ink-500)' }}>{lang === 'es' ? v.cap : v.capEn}</div>
                    </div>
                    <div style={{ width: 22, height: 22, borderRadius: 999, border: '2px solid ' + (on ? 'var(--brand)' : 'var(--line)'), background: on ? 'var(--brand)' : 'transparent' }} />
                  </button>
                );
              })}
            </div>
          )}

          {step === 2 && (<>
            <Field label={t('Placa', 'Plate')}><input className="input mono" style={{ textTransform: 'uppercase' }} value={draft.plate || ''} onChange={(e) => set({ plate: e.target.value })} placeholder="ABC-123" /></Field>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Field label={t('Marca', 'Make')}><input className="input" value={draft.brand || ''} onChange={(e) => set({ brand: e.target.value })} placeholder="Yamaha" /></Field>
              <Field label={t('Modelo', 'Model')}><input className="input" value={draft.model || ''} onChange={(e) => set({ model: e.target.value })} placeholder="—" /></Field>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Field label={t('Año', 'Year')}><input className="input mono" value={draft.year || ''} onChange={(e) => set({ year: e.target.value })} placeholder="2022" /></Field>
              <Field label={t('Color', 'Color')}><input className="input" value={draft.color || ''} onChange={(e) => set({ color: e.target.value })} placeholder={t('Negro', 'Black')} /></Field>
            </div>
          </>)}

          {step === 3 && (<>
            <div style={{ display: 'flex', gap: 9, padding: 12, background: 'var(--blue-tint)', borderRadius: 11, marginBottom: 14 }}>
              <p style={{ margin: 0, fontSize: 12.5, color: 'var(--blue-ink)', lineHeight: 1.45 }}>
                {t('Sube una foto del documento. Leemos los datos con OCR y autocompletamos tu formulario.',
                   'Upload a photo of the document. We read the data with OCR and auto-fill your form.')}
              </p>
            </div>
            {docTypes.map((d) => {
              const done = !!draft.docs?.[d.key];
              const isUp = uploading === d.key;
              return (
                <button key={d.key} onClick={() => pickFile(d.key)} disabled={isUp}
                  style={{ width: '100%', textAlign: 'left', border: '1px solid ' + (done ? 'var(--brand)' : 'var(--line)'),
                    background: done ? 'var(--brand-tint)' : 'var(--surface)', borderRadius: 12, padding: 13, display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                  <div style={{ width: 42, height: 42, borderRadius: 10, flexShrink: 0, display: 'grid', placeItems: 'center', background: done ? 'var(--brand)' : 'var(--surface-2)', color: done ? '#063' : 'var(--ink-600)', fontWeight: 700 }}>
                    {done ? '✓' : '↑'}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 14.5 }}>{lang === 'es' ? d.nameEs : d.nameEn}{d.required ? '' : ` · ${t('opcional', 'optional')}`}</div>
                    <div style={{ fontSize: 12, color: done ? 'var(--brand-ink)' : 'var(--ink-500)', marginTop: 1 }}>
                      {isUp ? t('Subiendo · leyendo…', 'Uploading · reading…') : done ? t('Cargado', 'Uploaded') : t('Toca para subir', 'Tap to upload')}
                    </div>
                  </div>
                </button>
              );
            })}
          </>)}

          {step === 4 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 9 }}>
              {zones.map((z) => chip((draft.zones || []).includes(z.slug), lang === 'es' ? z.nameEs : z.nameEn, () => toggleArr('zones', z.slug), z.slug))}
            </div>
          )}

          {step === 5 && (<>
            <div className="field-label">{t('Días disponibles', 'Available days')}</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
              {DAYS.map((d) => chip((draft.days || []).includes(d[0]), lang === 'es' ? d[1] : d[2], () => toggleArr('days', d[0]), d[0]))}
            </div>
            <div className="field-label">{t('Franjas horarias', 'Time blocks')}</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {BLOCKS.map((b) => {
                const on = (draft.blocks || []).includes(b[0]);
                return (
                  <button key={b[0]} onClick={() => toggleArr('blocks', b[0])} style={{ textAlign: 'left', padding: 13, borderRadius: 12, border: '1.5px solid ' + (on ? 'var(--brand)' : 'var(--line)'), background: on ? 'var(--brand-tint)' : 'var(--surface)' }}>
                    <div style={{ fontWeight: 600, fontSize: 14, color: on ? 'var(--brand-ink)' : 'var(--ink-900)' }}>{lang === 'es' ? b[1] : b[2]}</div>
                    <div className="mono" style={{ fontSize: 11, color: 'var(--ink-500)', marginTop: 2 }}>{b[3]}</div>
                  </button>
                );
              })}
            </div>
          </>)}

          {step === 6 && (
            <div className="card" style={{ padding: '4px 16px 12px' }}>
              {[
                [t('Nombre', 'Name'), draft.name || '—'],
                [t('Cédula', 'ID'), draft.cedula || '—'],
                [t('Vehículo', 'Vehicle'), `${VEHICLES.find((v) => v.id === draft.vehicle)?.[lang === 'es' ? 'es' : 'en'] || '—'} · ${draft.plate || '—'}`],
                [t('Documentos', 'Documents'), `${Object.values(draft.docs || {}).filter(Boolean).length} ${t('cargados', 'uploaded')}`],
                [t('Zonas', 'Zones'), (draft.zones || []).join(', ') || '—'],
                [t('Disponibilidad', 'Availability'), `${(draft.days || []).length} ${t('días', 'days')} · ${(draft.blocks || []).length} ${t('franjas', 'blocks')}`],
              ].map(([l, v], i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '11px 0', borderBottom: '1px solid var(--line-soft)' }}>
                  <span style={{ fontSize: 13.5, color: 'var(--ink-500)' }}>{l}</span>
                  <span style={{ fontSize: 13.5, fontWeight: 600, textAlign: 'right' }}>{v}</span>
                </div>
              ))}
              <p style={{ fontSize: 12, color: 'var(--ink-500)', lineHeight: 1.4, paddingTop: 12 }}>
                {t('Al enviar, autorizas la verificación de antecedentes y validación de documentos.',
                   'By submitting, you authorize background verification and document validation.')}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* footer */}
      <div style={{ padding: '12px 20px', borderTop: '1px solid var(--line)', background: 'var(--surface)' }}>
        <button className="btn btn-primary btn-lg btn-block" disabled={!canNext() || busy} onClick={next}>
          {busy ? '…' : step === STEPS - 1 ? t('Enviar solicitud', 'Submit application') : t('Continuar', 'Continue')}
        </button>
      </div>
      <Toast msg={toast} />
    </Phone>
  );
}

// ── root ────────────────────────────────────────────────────────
type View = 'loading' | 'welcome' | 'wizard' | 'pending';

export function App() {
  const [lang, setLang] = useState<Lang>('es');
  const [view, setView] = useState<View>('loading');
  const [ref, setRef] = useState<{ id: string; token: string } | null>(null);
  const [draft, setDraft] = useState<any>(null);
  const [submitted, setSubmitted] = useState<any>(null);

  const i18n = useMemo(() => ({ lang, setLang, t: (es: string, en: string) => (lang === 'es' ? es : en) }), [lang]);

  // consignee tracking link: /?track=<token> — public, no onboarding session
  const trackToken = useMemo(() => new URLSearchParams(window.location.search).get('track'), []);

  // resume an in-flight application on load
  useEffect(() => {
    if (trackToken) return;
    const s = session.get();
    if (!s) { setView('welcome'); return; }
    api.get(s.id, s.token)
      .then((app) => {
        setRef(s);
        if (app.status === 'in_review' || app.status === 'approved') { setSubmitted(app); setView('pending'); }
        else { setDraft(app.draft); setView('wizard'); }
      })
      .catch(() => { session.clear(); setView('welcome'); });
  }, []);

  const start = async () => {
    const r = await api.create();
    const s = { id: r.id, token: r.resumeToken };
    session.set(s);
    setRef(s);
    setDraft({});
    setView('wizard');
  };

  const reset = () => { session.clear(); setRef(null); setSubmitted(null); setView('welcome'); };

  if (trackToken) {
    return (
      <I18nCtx.Provider value={i18n}>
        <Tracking token={trackToken} />
      </I18nCtx.Provider>
    );
  }

  return (
    <I18nCtx.Provider value={i18n}>
      {view === 'loading' && <Phone><div /></Phone>}
      {view === 'welcome' && <Welcome onStart={start} />}
      {view === 'wizard' && ref && (
        <Wizard appId={ref.id} token={ref.token} initialDraft={draft}
          onSubmitted={(app) => { setSubmitted({ reference: app.reference }); setView('pending'); }}
          onExit={reset} />
      )}
      {view === 'pending' && submitted && <Pending app={submitted} onReset={reset} />}
    </I18nCtx.Provider>
  );
}
