import { useEffect, useMemo, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { api, DocType, driverAuth, session, Zone } from './lib/api';
import { I18nCtx, Lang, useI18n } from './lib/i18n';
import { Tracking } from './Tracking';
import { Rate } from './Rate';

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
// On a desktop browser this renders a centered phone mock; on a real phone
// (or narrow browser) the frame fills the viewport — see .device-* in styles.css.
function Phone({ children }: { children: React.ReactNode }) {
  return (
    <div className="device-shell">
      <div className="device-glow" />
      <div className="device-frame">
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
function Welcome({ onStart, onSignIn }: { onStart: () => void; onSignIn: () => void }) {
  const { t } = useI18n();
  return (
    <Phone>
      <div style={{ padding: '54px 26px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <div style={{ width: 30, height: 30, borderRadius: 8, background: 'var(--brand)' }} />
          <span className="display" style={{ fontSize: 17, fontWeight: 600 }}>PasarEx<span style={{ color: 'var(--brand-600)' }}>LM</span></span>
        </div>
        <LangToggle />
      </div>
      <div style={{ padding: '40px 26px', flex: 1, display: 'flex', flexDirection: 'column' }}>
        <span className="eyebrow" style={{ color: 'var(--brand-ink)' }}>{t('Conductor', 'Driver')}</span>
        <h1 className="display" style={{ fontSize: 34, lineHeight: 1.08, margin: '12px 0 14px' }}>
          {t('Conduce con PasarEx en Barbados.', 'Drive with PasarEx in Barbados.')}
        </h1>
        <p style={{ fontSize: 15.5, lineHeight: 1.5, color: 'var(--ink-600)', margin: 0 }}>
          {t('Sube tu licencia, seguro y registro del vehículo — los leemos con OCR y autocompletamos el formulario. Tras la verificación de seguridad empiezas a recibir entregas.',
             "Upload your driver's licence, insurance and vehicle registration — we read them with OCR and auto-fill the form. After the security check you start receiving deliveries.")}
        </p>
        <div style={{ marginTop: 'auto' }}>
          <button className="btn btn-primary btn-lg btn-block" onClick={onStart}>{t('Comenzar solicitud', 'Start application')}</button>
          <button className="btn btn-ghost btn-block" style={{ marginTop: 10 }} onClick={onSignIn}>{t('Ya soy conductor · Ingresar', 'Already a driver · Sign in')}</button>
        </div>
      </div>
    </Phone>
  );
}

// ── requirements + terms of service (must accept to apply) ──────
export const TERMS_VERSION = '2026-08-01';

const REQUIREMENTS = [
  { es: 'Ser mayor de 18 años', en: 'Be 18 or older',
    dEs: 'Debes tener al menos 18 años cumplidos para conducir con PasarEx.', dEn: 'You must be at least 18 years old to drive with PasarEx.' },
  { es: 'Licencia de conducción vigente', en: 'Valid driver’s licence',
    dEs: 'Licencia de conducción de Barbados vigente para la categoría de tu vehículo.', dEn: 'A current Barbados driver’s licence for your vehicle category.' },
  { es: 'Vehículo elegible con documentos al día', en: 'Eligible vehicle with current documents',
    dEs: 'Moto, carro, van o camioneta propios, con seguro obligatorio y registro vigentes.', dEn: 'Your own motorcycle, car, van or pickup, with valid compulsory insurance and registration.' },
  { es: 'Smartphone compatible', en: 'Compatible smartphone',
    dEs: 'iPhone o Android con plan de datos y GPS para recibir y rastrear entregas.', dEn: 'iPhone or Android with a data plan and GPS to receive and track deliveries.' },
  { es: 'Documento de identidad', en: 'Government-issued ID',
    dEs: 'Documento nacional de identidad de Barbados vigente para verificar tu identidad.', dEn: 'A valid Barbados national ID to verify your identity.' },
  { es: 'Verificación de antecedentes', en: 'Background check',
    dEs: 'Autorizas y debes aprobar la revisión de seguridad y antecedentes.', dEn: 'You authorize and must pass a security & background check.' },
  { es: 'Cuenta bancaria a tu nombre', en: 'Bank account in your name',
    dEs: 'Para recibir tus pagos por depósito directo.', dEn: 'To receive your earnings via direct deposit.' },
];

const TERMS = [
  { es: '1. Aceptación y elegibilidad', en: '1. Acceptance & eligibility',
    bEs: 'Al marcar la casilla de aceptación declaras que cumples todos los requisitos indicados y aceptas estos Términos de Servicio como condición para postularte y operar en la plataforma PasarEx LM.',
    bEn: 'By checking the acceptance box you represent that you meet all the requirements listed above and agree to these Terms of Service as a condition to apply for and operate on the PasarEx LM platform.' },
  { es: '2. Contratista independiente', en: '2. Independent contractor',
    bEs: 'Operas como contratista independiente. Estos Términos no crean una relación laboral, de agencia ni de sociedad. Eres responsable de tus impuestos y obligaciones de seguridad social.',
    bEn: 'You operate as an independent contractor. These Terms create no employment, agency or partnership relationship. You are responsible for your own taxes and social-security obligations.' },
  { es: '3. Verificación de antecedentes y seguridad', en: '3. Background & security verification',
    bEs: 'Autorizas a PasarEx LM y a sus aliados a verificar tu identidad, antecedentes y documentos. Aprobar la etapa de seguridad es obligatorio antes de recibir entregas.',
    bEn: 'You authorize PasarEx LM and its partners to verify your identity, background and documents. Passing the security stage is mandatory before you can receive deliveries.' },
  { es: '4. Veracidad de la información', en: '4. Accuracy of information',
    bEs: 'Garantizas que toda la información y los documentos que cargas son verídicos, propios y están vigentes. La información falsa o los documentos vencidos pueden suspender tu elegibilidad.',
    bEn: 'You warrant that all information and documents you upload are true, your own and current. False information or expired documents may suspend your eligibility.' },
  { es: '5. Vehículo, licencia y seguros', en: '5. Vehicle, license & insurance',
    bEs: 'Debes mantener tu licencia, seguro obligatorio y registro del vehículo vigentes, y conducir un vehículo en buen estado y debidamente asegurado conforme a la ley de Barbados.',
    bEn: "You must keep your driver's licence, compulsory insurance and vehicle registration current, and operate a roadworthy vehicle properly insured under the laws of Barbados." },
  { es: '6. Normas de conducta y servicio', en: '6. Conduct & service standards',
    bEs: 'Te comprometes a prestar un servicio seguro, puntual y respetuoso, a cumplir las normas de tránsito y a proteger la mercancía y los datos del destinatario.',
    bEn: 'You agree to provide safe, punctual and respectful service, to obey traffic laws, and to protect each shipment and the consignee’s data.' },
  { es: '7. Pagos', en: '7. Payments',
    bEs: 'Los pagos se liquidan por los fletes completados y se depositan en la cuenta bancaria a tu nombre. Las tarifas y condiciones pueden actualizarse y se notificarán en la app.',
    bEn: 'Payments are settled for completed freight and deposited to the bank account in your name. Rates and conditions may be updated and will be notified in the app.' },
  { es: '8. Calificaciones y desactivación', en: '8. Ratings & deactivation',
    bEs: 'Tu DriverScore se calcula con calificaciones y desempeño y afecta tu prioridad de asignación. PasarEx LM puede suspender o desactivar tu cuenta por incumplimiento de estos Términos.',
    bEn: 'Your DriverScore is computed from ratings and performance and affects your assignment priority. PasarEx LM may suspend or deactivate your account for breach of these Terms.' },
  { es: '9. Protección de datos', en: '9. Data protection',
    bEs: 'Autorizas el tratamiento de tus datos personales conforme a la Data Protection Act, 2019 de Barbados para operar el servicio, verificar tu elegibilidad y procesar pagos. Puedes acceder, actualizar y suprimir tus datos.',
    bEn: 'You authorize the processing of your personal data under the Barbados Data Protection Act, 2019 to operate the service, verify your eligibility and process payments. You may access, update and delete your data.' },
  { es: '10. Modificaciones y ley aplicable', en: '10. Modifications & governing law',
    bEs: 'PasarEx LM puede modificar estos Términos; el uso continuo implica aceptación. Estos Términos se rigen por las leyes de Barbados.',
    bEn: 'PasarEx LM may modify these Terms; continued use constitutes acceptance. These Terms are governed by the laws of Barbados.' },
];

function Requirements({ onAccept, onBack }: { onAccept: () => Promise<void> | void; onBack: () => void }) {
  const { t, lang } = useI18n();
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);

  const apply = async () => {
    if (!accepted || busy) return;
    setBusy(true);
    try { await onAccept(); } finally { setBusy(false); }
  };

  return (
    <Phone>
      <div style={{ paddingTop: 54 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 16px 12px' }}>
          <button onClick={onBack} style={{ width: 38, height: 38, borderRadius: 10, border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--ink-700)' }}>‹</button>
          <span className="mono" style={{ fontSize: 11, color: 'var(--ink-500)', letterSpacing: '.08em' }}>PASAREX LM</span>
          <LangToggle />
        </div>
        <div style={{ padding: '0 22px 12px' }}>
          <span className="eyebrow" style={{ color: 'var(--brand-ink)' }}>{t('Antes de empezar', 'Before you start')}</span>
          <h1 className="display" style={{ fontSize: 26, margin: '8px 0 5px' }}>{t('Requisitos y términos', 'Requirements & terms')}</h1>
          <p style={{ margin: 0, fontSize: 13.5, color: 'var(--ink-500)', lineHeight: 1.5 }}>
            {t('Para postularte como conductor debes cumplir con lo siguiente y aceptar los términos de servicio.',
               'To apply as a driver you must meet the following and accept the terms of service.')}
          </p>
        </div>
      </div>

      <div className="scroll" style={{ flex: 1, overflowY: 'auto', padding: '4px 22px 18px' }}>
        {/* requirements checklist */}
        <div style={{ display: 'grid', gap: 13, marginBottom: 22 }}>
          {REQUIREMENTS.map((r, i) => (
            <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <div style={{ width: 26, height: 26, borderRadius: 8, flexShrink: 0, background: 'var(--brand-tint)', color: 'var(--brand-ink)', display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: 14 }}>✓</div>
              <div>
                <div style={{ fontWeight: 600, fontSize: 14.5 }}>{lang === 'es' ? r.es : r.en}</div>
                <div style={{ fontSize: 12.5, color: 'var(--ink-500)', lineHeight: 1.45, marginTop: 1 }}>{lang === 'es' ? r.dEs : r.dEn}</div>
              </div>
            </div>
          ))}
        </div>

        {/* terms of service */}
        <div className="eyebrow" style={{ marginBottom: 8 }}>{t('Términos de servicio', 'Terms of service')}</div>
        <div style={{ border: '1px solid var(--line)', borderRadius: 12, padding: 14, background: 'var(--surface-2)', maxHeight: 240, overflowY: 'auto' }}>
          {TERMS.map((s, i) => (
            <div key={i} style={{ marginBottom: i === TERMS.length - 1 ? 0 : 12 }}>
              <div style={{ fontWeight: 600, fontSize: 13 }}>{lang === 'es' ? s.es : s.en}</div>
              <p style={{ margin: '3px 0 0', fontSize: 12.5, color: 'var(--ink-600)', lineHeight: 1.5 }}>{lang === 'es' ? s.bEs : s.bEn}</p>
            </div>
          ))}
          <p className="mono" style={{ fontSize: 10.5, color: 'var(--ink-400)', marginTop: 12, marginBottom: 0 }}>{t('Versión', 'Version')} {TERMS_VERSION}</p>
        </div>
      </div>

      {/* footer: accept + apply */}
      <div style={{ padding: '12px 20px', borderTop: '1px solid var(--line)', background: 'var(--surface)' }}>
        <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', cursor: 'pointer', marginBottom: 12 }}>
          <input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)}
            style={{ width: 18, height: 18, marginTop: 1, accentColor: 'var(--brand)', flexShrink: 0 }} />
          <span style={{ fontSize: 12.5, color: 'var(--ink-700)', lineHeight: 1.45 }}>
            {t('He leído y acepto los Términos de Servicio y confirmo que cumplo con todos los requisitos.',
               'I have read and accept the Terms of Service and confirm I meet all the requirements.')}
          </span>
        </label>
        <button className="btn btn-primary btn-lg btn-block" disabled={!accepted || busy} onClick={apply}>
          {busy ? '…' : t('Aceptar y postularme', 'Accept & apply')}
        </button>
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
  // password lives only in local state — never persisted to the (plaintext) draft
  const [password, setPassword] = useState('');
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
    if (step === 0) return draft.name && draft.phone && draft.cedula && draft.address;
    if (step === 1) return !!draft.vehicle;
    if (step === 2) return draft.plate && draft.brand && draft.year;
    if (step === 3) return allRequiredUploaded && password.trim().length >= 6;
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
        const res = await api.submit(appId, token, password.trim());
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
          <span className="mono" style={{ fontSize: 11, color: 'var(--ink-500)', letterSpacing: '.08em' }}>PASAREX LM</span>
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
            <Field label={t('Documento nacional', 'National ID')}><input className="input mono" value={draft.cedula || ''} onChange={(e) => set({ cedula: e.target.value })} placeholder="850101-1234" /></Field>
            <Field label={t('Celular', 'Mobile')}><input className="input mono" value={draft.phone || ''} onChange={(e) => set({ phone: e.target.value })} placeholder="+1 246 XXX XXXX" /></Field>
            <Field label={t('Correo (opcional)', 'Email (optional)')}><input className="input" value={draft.email || ''} onChange={(e) => set({ email: e.target.value })} placeholder="tu@correo.com" /></Field>
            <Field label={t('Dirección (según factura de servicios)', 'Address (as on your utility bill)')}><input className="input" value={draft.address || ''} onChange={(e) => set({ address: e.target.value })} placeholder={t('Calle, ciudad, parroquia', 'Street, city, parish')} /></Field>
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
            <Field label={t('Placa', 'Plate')}><input className="input mono" style={{ textTransform: 'uppercase' }} value={draft.plate || ''} onChange={(e) => set({ plate: e.target.value })} placeholder="P 1234" /></Field>
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

            {/* create the account password — the phone number is the username */}
            <div style={{ marginTop: 8, paddingTop: 16, borderTop: '1px solid var(--line)' }}>
              <div style={{ fontWeight: 600, fontSize: 14.5, marginBottom: 2 }}>{t('Crea tu contraseña', 'Create your password')}</div>
              <p style={{ margin: '0 0 12px', fontSize: 12.5, color: 'var(--ink-500)', lineHeight: 1.45 }}>
                {t('Tu número de celular será tu usuario para iniciar sesión.',
                   'Your mobile number will be your username to sign in.')}
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', border: '1px solid var(--line)', borderRadius: 9, background: 'var(--surface-2)', marginBottom: 10 }}>
                <span style={{ fontSize: 12.5, color: 'var(--ink-500)' }}>{t('Usuario', 'Username')}</span>
                <span className="mono" style={{ fontSize: 13, fontWeight: 600, marginLeft: 'auto' }}>{draft.phone || t('(agrega tu celular)', '(add your mobile)')}</span>
              </div>
              <input className="input" type="password" autoComplete="new-password" value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t('Contraseña (mín. 6 caracteres)', 'Password (min. 6 characters)')} />
              {password.length > 0 && password.trim().length < 6 && (
                <div style={{ fontSize: 12, color: 'var(--red-ink)', marginTop: 6 }}>{t('Mínimo 6 caracteres.', 'At least 6 characters.')}</div>
              )}
            </div>
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
                [t('Documento', 'ID'), draft.cedula || '—'],
                [t('Dirección', 'Address'), draft.address || '—'],
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

// ── driver sign-in + home (view/accept tenders, run deliveries) ─
const DFLOW = ['assigned', 'en_route_pickup', 'picked_up', 'en_route', 'delivered'];
const DLABEL: Record<string, [string, string]> = {
  assigned: ['Asignado', 'Assigned'],
  en_route_pickup: ['Yendo al hub', 'Heading to hub'],
  picked_up: ['Recogido', 'Picked up'],
  en_route: ['En ruta', 'On route'],
  delivered: ['Entregado', 'Delivered'],
  failed: ['Fallido', 'Failed'],
};
const nextStatus = (s: string) => { const i = DFLOW.indexOf(s); return i >= 0 && i < DFLOW.length - 1 ? DFLOW[i + 1] : null; };

function DriverLogin({ onDone, onBack }: { onDone: () => void; onBack: () => void }) {
  const { t } = useI18n();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setErr('');
    try { await api.login(phone.trim(), password); onDone(); } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };
  return (
    <Phone>
      <div style={{ paddingTop: 54 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 20px 12px' }}>
          <button onClick={onBack} style={{ width: 38, height: 38, borderRadius: 10, border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--ink-700)' }}>‹</button>
          <span className="display" style={{ fontSize: 17, fontWeight: 600 }}>PasarEx<span style={{ color: 'var(--brand-600)' }}>LM</span></span>
          <LangToggle />
        </div>
      </div>
      <form onSubmit={submit} style={{ padding: '8px 22px 22px', flex: 1, display: 'flex', flexDirection: 'column' }}>
        <h1 className="display" style={{ fontSize: 26, margin: '8px 0 4px' }}>{t('Iniciar sesión', 'Sign in')}</h1>
        <p style={{ color: 'var(--ink-500)', fontSize: 13.5, margin: '0 0 18px', lineHeight: 1.5 }}>{t('Usa tu número de celular y tu contraseña.', 'Use your mobile number and password.')}</p>
        <Field label={t('Celular', 'Mobile')}><input className="input mono" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1 246 XXX XXXX" /></Field>
        <Field label={t('Contraseña', 'Password')}><input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
        {err && <div className="badge badge-red" style={{ marginBottom: 12 }}>{err}</div>}
        <button className="btn btn-primary btn-lg btn-block" style={{ marginTop: 'auto' }} disabled={busy || !phone || !password}>{busy ? '…' : t('Ingresar', 'Sign in')}</button>
      </form>
    </Phone>
  );
}

function DaySheet() {
  const { t } = useI18n();
  const [day, setDay] = useState<any>(null);
  const [f, setF] = useState<any>({});
  const [busy, setBusy] = useState('');
  const load = () => api.getDay().then(setDay).catch(() => {});
  useEffect(() => { load(); }, []);
  const timeOf = (iso?: string) => (iso ? new Date(iso).toTimeString().slice(0, 5) : '');
  useEffect(() => {
    if (!day) return;
    setF({
      arrival: timeOf(day.depotArrivalAt), picked: day.packagesPicked ?? '', departure: timeOf(day.depotDepartureAt), startKm: day.startMileage ?? '',
      ret: timeOf(day.depotReturnAt), endKm: day.endMileage ?? '', success: day.successfulDeliveries ?? '', returned: day.packagesReturned ?? '',
    });
  }, [day?.operationalDate, day?.exists]);
  const dateOf = day?.operationalDate || new Date().toISOString().slice(0, 10);
  const iso = (tm?: string) => (tm ? new Date(`${dateOf}T${tm}:00`).toISOString() : undefined);
  const num = (v: any) => (v === '' || v == null ? undefined : Number(v));
  const set = (k: string, v: any) => setF((s: any) => ({ ...s, [k]: v }));

  const checkIn = async () => { setBusy('in'); try { await api.dayCheckIn({ depotArrivalAt: iso(f.arrival), packagesPicked: num(f.picked), depotDepartureAt: iso(f.departure), startMileage: num(f.startKm) }); await load(); } finally { setBusy(''); } };
  const checkOut = async () => { setBusy('out'); try { await api.dayCheckOut({ depotReturnAt: iso(f.ret), endMileage: num(f.endKm), successfulDeliveries: num(f.success), packagesReturned: num(f.returned) }); await load(); } finally { setBusy(''); } };

  const cell = (label: string, node: React.ReactNode) => (<div style={{ marginBottom: 10 }}><label className="field-label">{label}</label>{node}</div>);
  const numIn = (k: string, ph = '') => <input className="input mono" type="number" value={f[k] ?? ''} placeholder={ph} onChange={(e) => set(k, e.target.value)} />;
  const timeIn = (k: string) => <input className="input mono" type="time" value={f[k] ?? ''} onChange={(e) => set(k, e.target.value)} />;

  return (
    <div className="card" style={{ padding: 14, marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span className="eyebrow">{t('Hoja del día', 'Day sheet')}</span>
        <span className="mono" style={{ fontSize: 11, color: 'var(--ink-500)' }}>{dateOf}{day?.deliverySuccess != null ? ` · ${t('éxito', 'success')} ${day.deliverySuccess}%` : ''}</span>
      </div>
      <div className="eyebrow" style={{ margin: '12px 0 8px', color: 'var(--brand-ink)' }}>{t('Llegada al depósito', 'Depot check-in')}</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {cell(t('Hora de llegada', 'Arrival time'), timeIn('arrival'))}
        {cell(t('Paquetes recogidos', 'Packages picked'), numIn('picked'))}
        {cell(t('Hora de salida', 'Departure time'), timeIn('departure'))}
        {cell(t('Millaje inicial', 'Start mileage'), numIn('startKm'))}
      </div>
      <button className="btn btn-ghost btn-block" disabled={busy === 'in'} onClick={checkIn}>{busy === 'in' ? '…' : t('Guardar llegada', 'Save check-in')}</button>

      <div className="eyebrow" style={{ margin: '16px 0 8px', color: 'var(--brand-ink)' }}>{t('Fin del día', 'End of day')}</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {cell(t('Hora de regreso', 'Return time'), timeIn('ret'))}
        {cell(t('Millaje final', 'End mileage'), numIn('endKm'))}
        {cell(t('Entregas exitosas', 'Successful deliveries'), numIn('success'))}
        {cell(t('Paquetes devueltos', 'Packages returned'), numIn('returned'))}
      </div>
      <button className="btn btn-ghost btn-block" disabled={busy === 'out'} onClick={checkOut}>{busy === 'out' ? '…' : t('Guardar fin del día', 'Save end of day')}</button>
      {day?.mileage != null && <div style={{ fontSize: 12, color: 'var(--ink-500)', marginTop: 10, textAlign: 'center' }}>{t('Millaje del día', 'Day mileage')}: <b>{day.mileage}</b></div>}
    </div>
  );
}

const DOW: [number, string, string][] = [[1, 'Lun', 'Mon'], [2, 'Mar', 'Tue'], [3, 'Mié', 'Wed'], [4, 'Jue', 'Thu'], [5, 'Vie', 'Fri'], [6, 'Sáb', 'Sat'], [0, 'Dom', 'Sun']];

function DriverProfileEdit({ onBack }: { onBack: () => void }) {
  const { t, lang } = useI18n();
  const [p, setP] = useState<any>(null);
  const [zones, setZones] = useState<Zone[]>([]);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => { api.getProfile().then((d) => setP({ ...d, vehicle: d.vehicle || {}, days: d.days || [], blocks: d.blocks || [], zones: d.zones || [] })).catch(() => {}); api.operatingAreas().then(setZones).catch(() => {}); }, []);

  const setV = (k: string, v: any) => setP((s: any) => ({ ...s, vehicle: { ...s.vehicle, [k]: v } }));
  const toggle = (key: 'days' | 'blocks' | 'zones', val: any) => setP((s: any) => { const arr = s[key] || []; return { ...s, [key]: arr.includes(val) ? arr.filter((x: any) => x !== val) : [...arr, val] }; });
  const chip = (active: boolean, label: string, onClick: () => void, key: string) => (
    <button key={key} onClick={onClick} style={{ border: '1px solid ' + (active ? 'var(--brand)' : 'var(--line)'), background: active ? 'var(--brand-tint)' : 'var(--surface)', color: active ? 'var(--brand-ink)' : 'var(--ink-700)', borderRadius: 999, padding: '7px 13px', fontSize: 13, fontWeight: 600 }}>{label}</button>
  );

  const save = async () => {
    setBusy(true);
    try {
      const r = await api.updateProfile({ name: p.name, phone: p.phone, email: p.email, vehicle: p.vehicle, days: p.days, blocks: p.blocks, zones: p.zones, address: p.address });
      setP({ ...r, vehicle: r.vehicle || {}, days: r.days || [], blocks: r.blocks || [], zones: r.zones || [] });
      setToast(t('Guardado', 'Saved')); setTimeout(() => setToast(null), 2200);
    } catch (e: any) { setToast(e.message); setTimeout(() => setToast(null), 3000); } finally { setBusy(false); }
  };

  return (
    <Phone>
      <div style={{ paddingTop: 54 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 16px 12px' }}>
          <button onClick={onBack} style={{ width: 38, height: 38, borderRadius: 10, border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--ink-700)' }}>‹</button>
          <span className="mono" style={{ fontSize: 11, color: 'var(--ink-500)', letterSpacing: '.08em' }}>PASAREX LM</span>
          <LangToggle />
        </div>
        <div style={{ padding: '0 22px 8px' }}><h1 className="display" style={{ fontSize: 24, margin: 0 }}>{t('Mi perfil', 'My profile')}</h1></div>
      </div>
      <div className="scroll" style={{ flex: 1, overflowY: 'auto', padding: '8px 22px 20px' }}>
        {!p && <div style={{ color: 'var(--ink-500)' }}>…</div>}
        {p && (<>
          <div className="eyebrow" style={{ marginBottom: 8 }}>{t('Datos personales', 'Personal details')}</div>
          <Field label={t('Nombre completo', 'Full name')}><input className="input" value={p.name || ''} onChange={(e) => setP({ ...p, name: e.target.value })} /></Field>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label={t('Celular (usuario)', 'Mobile (username)')}><input className="input mono" value={p.phone || ''} onChange={(e) => setP({ ...p, phone: e.target.value })} /></Field>
            <Field label={t('Correo', 'Email')}><input className="input" value={p.email || ''} onChange={(e) => setP({ ...p, email: e.target.value })} /></Field>
          </div>
          <div className="eyebrow" style={{ marginBottom: 8 }}>{t('Dirección', 'Address')}</div>
          <Field label={t('Dirección (según factura de servicios)', 'Address (as on your utility bill)')}><input className="input" value={p.address || ''} onChange={(e) => setP({ ...p, address: e.target.value })} placeholder={t('Calle, ciudad, parroquia', 'Street, city, parish')} /></Field>
          <div className="eyebrow" style={{ marginBottom: 8 }}>{t('Vehículo', 'Vehicle')}</div>
          <div style={{ display: 'grid', gap: 11, marginBottom: 8 }}>
            {VEHICLES.map((v) => {
              const on = p.vehicle.type === v.id;
              return (
                <button key={v.id} onClick={() => { setV('type', v.id); setV('capacity', lang === 'es' ? v.cap : v.capEn); }}
                  style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12, borderRadius: 12, textAlign: 'left', border: '1.5px solid ' + (on ? 'var(--brand)' : 'var(--line)'), background: on ? 'var(--brand-tint)' : 'var(--surface)' }}>
                  <div style={{ flex: 1 }}><div style={{ fontWeight: 600 }}>{lang === 'es' ? v.es : v.en}</div><div style={{ fontSize: 12, color: 'var(--ink-500)' }}>{lang === 'es' ? v.cap : v.capEn}</div></div>
                  <div style={{ width: 20, height: 20, borderRadius: 999, border: '2px solid ' + (on ? 'var(--brand)' : 'var(--line)'), background: on ? 'var(--brand)' : 'transparent' }} />
                </button>
              );
            })}
          </div>
          <Field label={t('Placa', 'Plate')}><input className="input mono" style={{ textTransform: 'uppercase' }} value={p.vehicle.plate || ''} onChange={(e) => setV('plate', e.target.value)} placeholder="P 1234" /></Field>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label={t('Marca', 'Make')}><input className="input" value={p.vehicle.brand || ''} onChange={(e) => setV('brand', e.target.value)} /></Field>
            <Field label={t('Modelo', 'Model')}><input className="input" value={p.vehicle.model || ''} onChange={(e) => setV('model', e.target.value)} /></Field>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label={t('Año', 'Year')}><input className="input mono" value={p.vehicle.year || ''} onChange={(e) => setV('year', e.target.value)} /></Field>
            <Field label={t('Color', 'Color')}><input className="input" value={p.vehicle.color || ''} onChange={(e) => setV('color', e.target.value)} /></Field>
          </div>

          <div className="eyebrow" style={{ margin: '10px 0 8px' }}>{t('Días disponibles', 'Available days')}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
            {DOW.map((d) => chip((p.days || []).includes(d[0]), lang === 'es' ? d[1] : d[2], () => toggle('days', d[0]), 'd' + d[0]))}
          </div>
          <div className="eyebrow" style={{ marginBottom: 8 }}>{t('Franjas horarias', 'Time blocks')}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
            {BLOCKS.map((b) => chip((p.blocks || []).includes(b[0]), (lang === 'es' ? b[1] : b[2]) + ` ${b[3]}`, () => toggle('blocks', b[0]), b[0]))}
          </div>
          <div className="eyebrow" style={{ marginBottom: 8 }}>{t('Zonas de operación', 'Operating zones')}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {zones.map((z) => chip((p.zones || []).includes(z.slug), lang === 'es' ? z.nameEs : z.nameEn, () => toggle('zones', z.slug), z.slug))}
          </div>
        </>)}
      </div>
      <div style={{ padding: '12px 20px', borderTop: '1px solid var(--line)', background: 'var(--surface)' }}>
        <button className="btn btn-primary btn-lg btn-block" disabled={!p || busy} onClick={save}>{busy ? '…' : t('Guardar cambios', 'Save changes')}</button>
      </div>
      <Toast msg={toast} />
    </Phone>
  );
}

function DriverHome({ onLogout }: { onLogout: () => void }) {
  const { t, lang } = useI18n();
  const [offers, setOffers] = useState<any[]>([]);
  const [deliveries, setDeliveries] = useState<any[]>([]);
  const [zones, setZones] = useState<Record<string, any>>({});
  const [toast, setToast] = useState<string | null>(null);
  const [busy, setBusy] = useState('');
  const [screen, setScreen] = useState<'home' | 'profile'>('home');
  const sock = useRef<Socket | null>(null);
  const auth = driverAuth.get();
  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(null), 2600); };
  const parishName = (slug?: string) => (slug && zones[slug]) ? (lang === 'es' ? zones[slug].nameEs : zones[slug].nameEn) : (slug || '');

  const load = async () => {
    try { setOffers(await api.myTenders()); } catch { /* ignore */ }
    try { setDeliveries(await api.myDeliveries()); } catch { /* ignore */ }
  };
  useEffect(() => {
    api.operatingAreas().then((zs) => setZones(Object.fromEntries(zs.map((z) => [z.slug, z])))).catch(() => {});
    load();
    const s = io({ path: '/socket.io', transports: ['websocket', 'polling'] });
    sock.current = s;
    s.on('connect', () => { if (auth?.driverId) s.emit('join', { room: `driver:${auth.driverId}` }); });
    s.on('plan.tender', () => load());
    s.on('plan.tender.cancelled', () => load());
    s.on('delivery.updated', () => load());
    return () => { s.disconnect(); };
  }, []);

  const accept = async (o: any) => { setBusy(o.id); try { const r = await api.acceptTender(o.id); flash(`${t('Aceptado', 'Accepted')} · ${r.packages} ${t('paquetes', 'pkgs')}`); await load(); } catch (e: any) { flash(e.message); } finally { setBusy(''); } };
  const decline = async (o: any) => { setBusy(o.id); try { await api.declineTender(o.id); await load(); } catch (e: any) { flash(e.message); } finally { setBusy(''); } };
  const advance = async (d: any) => { const ns = nextStatus(d.status); if (!ns) return; setBusy(d.id); try { await api.advanceDelivery(d.id, ns); await load(); } catch (e: any) { flash(e.message); } finally { setBusy(''); } };

  if (screen === 'profile') return <DriverProfileEdit onBack={() => setScreen('home')} />;

  return (
    <Phone>
      <div style={{ paddingTop: 54 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 20px 12px' }}>
          <span className="display" style={{ fontSize: 17, fontWeight: 600 }}>PasarEx<span style={{ color: 'var(--brand-600)' }}>LM</span></span>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button onClick={() => setScreen('profile')} className="btn btn-ghost" style={{ padding: '5px 10px', fontSize: 12 }}>{t('Perfil', 'Profile')}</button>
            <LangToggle /><button onClick={onLogout} className="btn btn-ghost" style={{ padding: '5px 10px', fontSize: 12 }}>{t('Salir', 'Sign out')}</button>
          </div>
        </div>
        <div style={{ padding: '0 20px 8px' }}>
          <span className="eyebrow" style={{ color: 'var(--brand-ink)' }}>{t('Hola', 'Hi')}{auth?.name ? `, ${auth.name.split(' ')[0]}` : ''}</span>
          <h1 className="display" style={{ fontSize: 24, margin: '4px 0 0' }}>{t('Tus fletes', 'Your freight')}</h1>
        </div>
      </div>
      <div className="scroll" style={{ flex: 1, overflowY: 'auto', padding: '8px 20px 20px' }}>
        <DaySheet />
        <div className="eyebrow" style={{ margin: '6px 0 8px' }}>{t('Ofertas', 'Offers')} ({offers.length})</div>
        {!offers.length && <div style={{ fontSize: 13, color: 'var(--ink-500)', marginBottom: 14 }}>{t('No hay ofertas ahora.', 'No offers right now.')}</div>}
        {offers.map((o) => (
          <div key={o.id} className="card" style={{ padding: 14, marginBottom: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <strong style={{ fontSize: 15 }}>{parishName(o.parish)}</strong>
              <span className="badge badge-brand">{o.packages} {t('paquetes', 'pkgs')}</span>
            </div>
            <div className="mono" style={{ fontSize: 11.5, color: 'var(--ink-500)', margin: '3px 0 10px' }}>{t('Recoge en', 'Pick up at')} {o.hub}</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-primary" style={{ flex: 1 }} disabled={busy === o.id} onClick={() => accept(o)}>{t('Aceptar', 'Accept')}</button>
              <button className="btn btn-ghost" disabled={busy === o.id} onClick={() => decline(o)}>{t('Rechazar', 'Decline')}</button>
            </div>
          </div>
        ))}

        <div className="eyebrow" style={{ margin: '18px 0 8px' }}>{t('Tus entregas', 'Your deliveries')}</div>
        {!deliveries.length && <div style={{ fontSize: 13, color: 'var(--ink-500)' }}>{t('Aún no tienes entregas.', 'No deliveries yet.')}</div>}
        {deliveries.map((d) => {
          const ns = nextStatus(d.status);
          const terminal = d.status === 'delivered' || d.status === 'failed';
          return (
            <div key={d.id} className="card" style={{ padding: 14, marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <strong style={{ fontSize: 15 }}>{parishName(d.parish) || d.reference}</strong>
                {d.packages != null && <span className="badge badge-gray">{d.packages} {t('paquetes', 'pkgs')}</span>}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10, gap: 8 }}>
                <span className={`badge ${terminal ? (d.status === 'delivered' ? 'badge-brand' : 'badge-red') : 'badge-blue'}`}>{t(DLABEL[d.status]?.[0] || d.status, DLABEL[d.status]?.[1] || d.status)}</span>
                {ns && <button className="btn btn-dark" style={{ padding: '7px 12px' }} disabled={busy === d.id} onClick={() => advance(d)}>{t('Marcar', 'Mark')} {t(DLABEL[ns][0], DLABEL[ns][1])}</button>}
              </div>
            </div>
          );
        })}
      </div>
      <Toast msg={toast} />
    </Phone>
  );
}

// ── root ────────────────────────────────────────────────────────
type View = 'loading' | 'welcome' | 'requirements' | 'wizard' | 'pending' | 'login' | 'home';

export function App() {
  const [lang, setLang] = useState<Lang>('en');
  const [view, setView] = useState<View>('loading');
  const [ref, setRef] = useState<{ id: string; token: string } | null>(null);
  const [draft, setDraft] = useState<any>(null);
  const [submitted, setSubmitted] = useState<any>(null);

  const i18n = useMemo(() => ({ lang, setLang, t: (es: string, en: string) => (lang === 'es' ? es : en) }), [lang]);

  // public link surfaces: /?track=<token> (consignee tracking) | /?rate=<token> (rating)
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const trackToken = params.get('track');
  const rateToken = params.get('rate');

  // resume an in-flight application on load
  useEffect(() => {
    if (trackToken || rateToken) return;
    if (driverAuth.get()) { setView('home'); return; } // signed-in driver
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

  // called only after the applicant accepts the requirements + terms of service
  const start = async () => {
    const r = await api.create();
    const s = { id: r.id, token: r.resumeToken };
    session.set(s);
    setRef(s);
    // record the acceptance on the application (auditable, retained on submit)
    const acceptance = { termsAcceptedAt: new Date().toISOString(), termsVersion: TERMS_VERSION };
    setDraft(acceptance);
    try { await api.patch(r.id, r.resumeToken, acceptance); } catch { /* offline tolerated */ }
    setView('wizard');
  };

  const reset = () => { session.clear(); setRef(null); setSubmitted(null); setView('welcome'); };

  if (trackToken || rateToken) {
    return (
      <I18nCtx.Provider value={i18n}>
        {trackToken ? <Tracking token={trackToken} /> : <Rate token={rateToken!} />}
      </I18nCtx.Provider>
    );
  }

  return (
    <I18nCtx.Provider value={i18n}>
      {view === 'loading' && <Phone><div /></Phone>}
      {view === 'welcome' && <Welcome onStart={() => setView('requirements')} onSignIn={() => setView('login')} />}
      {view === 'requirements' && <Requirements onAccept={start} onBack={() => setView('welcome')} />}
      {view === 'login' && <DriverLogin onDone={() => setView('home')} onBack={() => setView('welcome')} />}
      {view === 'home' && <DriverHome onLogout={() => { driverAuth.clear(); setView('welcome'); }} />}
      {view === 'wizard' && ref && (
        <Wizard appId={ref.id} token={ref.token} initialDraft={draft}
          onSubmitted={(app) => { setSubmitted({ reference: app.reference }); setView('pending'); }}
          onExit={reset} />
      )}
      {view === 'pending' && submitted && <Pending app={submitted} onReset={reset} />}
    </I18nCtx.Provider>
  );
}
