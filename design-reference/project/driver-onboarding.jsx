// driver-onboarding.jsx — the application wizard (priority flow)
const { useState: useStateOB } = React;

function OBProgress({ step, total }) {
  const { t } = useStore();
  return (
    <div style={{ padding: '0 20px 14px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
        <span className="eyebrow">{t('Paso', 'Step')} {step + 1} / {total}</span>
        <span className="mono" style={{ fontSize: 11, color: 'var(--brand-ink)', fontWeight: 600 }}>
          {Math.round(((step) / total) * 100)}%
        </span>
      </div>
      <div className="track"><span style={{ width: ((step) / total) * 100 + '%' }} /></div>
    </div>
  );
}

function Field({ label, children, hint }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label className="field-label">{label}</label>
      {children}
      {hint && <div style={{ fontSize: 12, color: 'var(--ink-500)', marginTop: 5 }}>{hint}</div>}
    </div>
  );
}

function DocTile({ name, icon, sub, done, onToggle, hint }) {
  return (
    <button onClick={onToggle} style={{ width: '100%', textAlign: 'left', border: '1px solid ' + (done ? 'var(--brand)' : 'var(--line)'),
      background: done ? 'var(--brand-tint)' : 'var(--surface)', borderRadius: 12, padding: 13, display: 'flex',
      alignItems: 'center', gap: 12, transition: 'all .15s', marginBottom: 10 }}>
      <div style={{ width: 42, height: 42, borderRadius: 10, flexShrink: 0, display: 'grid', placeItems: 'center',
        background: done ? 'var(--brand)' : 'var(--surface-2)', color: done ? '#063' : 'var(--ink-600)' }}>
        <Icon name={done ? 'check' : icon} size={20} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 14.5, color: 'var(--ink-900)' }}>{name}</div>
        <div style={{ fontSize: 12, color: done ? 'var(--brand-ink)' : 'var(--ink-500)', marginTop: 1 }}>{done ? hint : sub}</div>
      </div>
      <div style={{ color: done ? 'var(--brand-ink)' : 'var(--ink-400)' }}>
        <Icon name={done ? 'checkCircle' : 'upload'} size={20} />
      </div>
    </button>
  );
}

function DriverOnboarding({ onSubmit, onExit }) {
  const { t, lang, draft, updateDraft, VEHICLES, ZONES, vehicleById } = useStore();
  const [step, setStep] = useStateOB(0);
  const STEPS = 7;
  const set = (patch) => updateDraft(patch);

  const days = [['lun','Lun','Mon'],['mar','Mar','Tue'],['mie','Mié','Wed'],['jue','Jue','Thu'],['vie','Vie','Fri'],['sab','Sáb','Sat'],['dom','Dom','Sun']];
  const blocks = [['madrugada','Madrugada','Early','00–06'],['manana','Mañana','Morning','06–12'],['tarde','Tarde','Afternoon','12–18'],['noche','Noche','Night','18–24']];

  const toggleArr = (key, val) => {
    const arr = draft[key] || [];
    set({ [key]: arr.includes(val) ? arr.filter(v => v !== val) : [...arr, val] });
  };
  const toggleDoc = (k) => set({ docs: { ...draft.docs, [k]: !draft.docs[k] } });

  const docList = [
    { k: 'license',  icon: 'doc',    es: 'Licencia de conducción', en: "Driver's license", sub: t('Frente y reverso', 'Front and back') },
    { k: 'soat',     icon: 'shield', es: 'SOAT vigente', en: 'SOAT (mandatory insurance)', sub: t('Seguro obligatorio', 'Mandatory coverage') },
    { k: 'insurance',icon: 'shield', es: 'Póliza todo riesgo', en: 'All-risk policy', sub: t('Opcional · suma puntos', 'Optional · adds points') },
    { k: 'property', icon: 'doc',    es: 'Tarjeta de propiedad', en: 'Vehicle registration', sub: t('Del vehículo', 'Of the vehicle') },
    { k: 'id',       icon: 'camera', es: 'Cédula + selfie', en: 'ID + selfie', sub: t('Verificación de identidad', 'Identity check') },
  ];

  const canNext = () => {
    if (step === 0) return draft.name && draft.phone && draft.cedula;
    if (step === 1) return !!draft.vehicle;
    if (step === 2) return draft.plate && draft.brand && draft.year;
    if (step === 3) return draft.docs.license && draft.docs.soat && draft.docs.property && draft.docs.id;
    if (step === 4) return draft.zones.length > 0;
    if (step === 5) return draft.days.length > 0 && draft.blocks.length > 0;
    return true;
  };

  const next = () => { if (step < STEPS - 1) setStep(step + 1); else onSubmit(); };
  const back = () => { if (step === 0) onExit(); else setStep(step - 1); };

  const chip = (active, label, onClick, key) => (
    <button key={key} onClick={onClick} style={{ border: '1px solid ' + (active ? 'var(--brand)' : 'var(--line)'),
      background: active ? 'var(--brand-tint)' : 'var(--surface)', color: active ? 'var(--brand-ink)' : 'var(--ink-700)',
      borderRadius: 999, padding: '8px 14px', fontSize: 13.5, fontWeight: 600, transition: 'all .12s' }}>{label}</button>
  );

  const titles = [
    [t('Tus datos', 'Your details'), t('Creamos tu perfil de conductor', 'We create your driver profile')],
    [t('Tu vehículo', 'Your vehicle'), t('¿Con qué vas a repartir?', 'What will you deliver with?')],
    [t('Características', 'Vehicle specs'), t('Datos de tu ' + (vehicleById(draft.vehicle)?.es || 'vehículo').toLowerCase(), 'Details of your vehicle')],
    [t('Documentos', 'Documents'), t('Sube tus documentos legales', 'Upload your legal documents')],
    [t('Zonas de operación', 'Operating zones'), t('¿Dónde quieres repartir?', 'Where do you want to operate?')],
    [t('Disponibilidad', 'Availability'), t('Tus días y horarios', 'Your days and hours')],
    [t('Revisa y envía', 'Review & submit'), t('Confirma tu solicitud', 'Confirm your application')],
  ];

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--paper)' }}>
      {/* header */}
      <div style={{ paddingTop: 54 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 16px 12px' }}>
          <button onClick={back} style={{ width: 38, height: 38, borderRadius: 10, border: '1px solid var(--line)',
            background: 'var(--surface)', display: 'grid', placeItems: 'center', color: 'var(--ink-700)' }}>
            <Icon name="chevL" size={18} />
          </button>
          <span className="mono" style={{ fontSize: 11, color: 'var(--ink-500)', letterSpacing: '.08em' }}>SHERPA LM</span>
          <LangToggle />
        </div>
        <OBProgress step={step} total={STEPS} />
        <div style={{ padding: '0 20px 12px' }}>
          <h1 className="display" style={{ fontSize: 25, margin: '0 0 3px', color: 'var(--ink-900)' }}>{titles[step][0]}</h1>
          <p style={{ margin: 0, fontSize: 14, color: 'var(--ink-500)' }}>{titles[step][1]}</p>
        </div>
      </div>

      {/* body */}
      <div className="scroll" key={step} style={{ flex: 1, overflowY: 'auto', padding: '4px 20px 20px' }}>
        <div className="fade-up">
          {step === 0 && (<>
            <Field label={t('Nombre completo', 'Full name')}><input className="input" value={draft.name} onChange={e => set({ name: e.target.value })} placeholder={t('Ej. Juan Pérez', 'e.g. Juan Pérez')} /></Field>
            <Field label={t('Cédula de ciudadanía', 'National ID (cédula)')}><input className="input mono" value={draft.cedula} onChange={e => set({ cedula: e.target.value })} placeholder="1.0XX.XXX.XXX" /></Field>
            <Field label={t('Celular', 'Mobile')}><input className="input mono" value={draft.phone} onChange={e => set({ phone: e.target.value })} placeholder="+57 3XX XXX XXXX" /></Field>
            <Field label={t('Correo (opcional)', 'Email (optional)')}><input className="input" value={draft.email} onChange={e => set({ email: e.target.value })} placeholder="tu@correo.com" /></Field>
          </>)}

          {step === 1 && (
            <div style={{ display: 'grid', gap: 11 }}>
              {VEHICLES.map(v => {
                const on = draft.vehicle === v.id;
                return (
                  <button key={v.id} onClick={() => set({ vehicle: v.id, capacity: lang === 'es' ? v.cap : v.capEn })}
                    style={{ display: 'flex', alignItems: 'center', gap: 14, padding: 13, borderRadius: 13, textAlign: 'left',
                      border: '1.5px solid ' + (on ? 'var(--brand)' : 'var(--line)'), background: on ? 'var(--brand-tint)' : 'var(--surface)', transition: 'all .15s' }}>
                    <VehicleGlyph id={v.id} size={48} tone={on ? 'brand' : 'ink'} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: 16, color: 'var(--ink-900)' }}>{lang === 'es' ? v.es : v.en}</div>
                      <div style={{ fontSize: 12.5, color: 'var(--ink-500)' }}>{lang === 'es' ? v.cap : v.capEn}</div>
                    </div>
                    <div style={{ width: 22, height: 22, borderRadius: 999, border: '2px solid ' + (on ? 'var(--brand)' : 'var(--line)'),
                      background: on ? 'var(--brand)' : 'transparent', display: 'grid', placeItems: 'center', color: '#063' }}>
                      {on && <Icon name="check" size={13} stroke={3} />}
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {step === 2 && (<>
            <Field label={t('Placa', 'Plate')}><input className="input mono" style={{ textTransform: 'uppercase' }} value={draft.plate} onChange={e => set({ plate: e.target.value })} placeholder="ABC-123" /></Field>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Field label={t('Marca', 'Make')}><input className="input" value={draft.brand} onChange={e => set({ brand: e.target.value })} placeholder={t('Ej. Yamaha', 'e.g. Yamaha')} /></Field>
              <Field label={t('Modelo', 'Model')}><input className="input" value={draft.model} onChange={e => set({ model: e.target.value })} placeholder="—" /></Field>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Field label={t('Año', 'Year')}><input className="input mono" value={draft.year} onChange={e => set({ year: e.target.value })} placeholder="2022" /></Field>
              <Field label={t('Color', 'Color')}><input className="input" value={draft.color} onChange={e => set({ color: e.target.value })} placeholder={t('Negro', 'Black')} /></Field>
            </div>
            <Field label={t('Capacidad de carga', 'Cargo capacity')} hint={t('Calculada según tu tipo de vehículo', 'Based on your vehicle type')}>
              <input className="input" value={draft.capacity} onChange={e => set({ capacity: e.target.value })} readOnly />
            </Field>
          </>)}

          {step === 3 && (<>
            <div style={{ display: 'flex', gap: 9, padding: 12, background: 'var(--blue-tint)', borderRadius: 11, marginBottom: 14 }}>
              <span style={{ color: 'var(--blue-ink)', flexShrink: 0, marginTop: 1 }}><Icon name="shield" size={18} /></span>
              <p style={{ margin: 0, fontSize: 12.5, color: 'var(--blue-ink)', lineHeight: 1.45 }}>
                {t('Tus documentos se validan automáticamente y pasan a revisión de seguridad antes de la aprobación.',
                   'Your documents are auto-validated and go through a security review before approval.')}
              </p>
            </div>
            {docList.map(d => (
              <DocTile key={d.k} name={lang === 'es' ? d.es : d.en} icon={d.icon} sub={d.sub}
                done={draft.docs[d.k]} onToggle={() => toggleDoc(d.k)} hint={t('Cargado · validando…', 'Uploaded · validating…')} />
            ))}
          </>)}

          {step === 4 && (<>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 9, marginBottom: 16 }}>
              {ZONES.map(z => chip(draft.zones.includes(z.id), z.es, () => toggleArr('zones', z.id), z.id))}
            </div>
            <div className="card" style={{ overflow: 'hidden', height: 180 }}>
              <MapCanvas height="180px" drivers={[]} showZones
                you={null} />
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--ink-500)', marginTop: 10, textAlign: 'center' }}>
              {draft.zones.length} {t('zonas seleccionadas en Bogotá', 'zones selected in Bogotá')}
            </div>
          </>)}

          {step === 5 && (<>
            <div className="field-label">{t('Días disponibles', 'Available days')}</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
              {days.map(d => chip(draft.days.includes(d[0]), lang === 'es' ? d[1] : d[2], () => toggleArr('days', d[0]), d[0]))}
            </div>
            <div className="field-label">{t('Franjas horarias', 'Time blocks')}</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {blocks.map(b => {
                const on = draft.blocks.includes(b[0]);
                return (
                  <button key={b[0]} onClick={() => toggleArr('blocks', b[0])} style={{ textAlign: 'left', padding: 13, borderRadius: 12,
                    border: '1.5px solid ' + (on ? 'var(--brand)' : 'var(--line)'), background: on ? 'var(--brand-tint)' : 'var(--surface)' }}>
                    <div style={{ fontWeight: 600, fontSize: 14, color: on ? 'var(--brand-ink)' : 'var(--ink-900)' }}>{lang === 'es' ? b[1] : b[2]}</div>
                    <div className="mono" style={{ fontSize: 11, color: 'var(--ink-500)', marginTop: 2 }}>{b[3]}</div>
                  </button>
                );
              })}
            </div>
          </>)}

          {step === 6 && <OBReview draft={draft} />}
        </div>
      </div>

      {/* footer */}
      <div style={{ padding: '12px 20px calc(12px + env(safe-area-inset-bottom))', borderTop: '1px solid var(--line)', background: 'var(--surface)' }}>
        <button className="btn btn-primary btn-lg btn-block" disabled={!canNext()} onClick={next}>
          {step === STEPS - 1 ? t('Enviar solicitud', 'Submit application') : t('Continuar', 'Continue')}
          <Icon name="arrowR" size={18} />
        </button>
      </div>
    </div>
  );
}

function OBReview({ draft }) {
  const { t, lang, vehicleById, zoneById } = useStore();
  const docCount = Object.values(draft.docs).filter(Boolean).length;
  const Row = ({ label, value }) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '11px 0', borderBottom: '1px solid var(--line-soft)' }}>
      <span style={{ fontSize: 13.5, color: 'var(--ink-500)' }}>{label}</span>
      <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink-900)', textAlign: 'right' }}>{value}</span>
    </div>
  );
  return (
    <div className="card" style={{ padding: '4px 16px 8px' }}>
      <Row label={t('Nombre', 'Name')} value={draft.name || '—'} />
      <Row label={t('Cédula', 'ID')} value={draft.cedula || '—'} />
      <Row label={t('Vehículo', 'Vehicle')} value={(vehicleById(draft.vehicle)?.[lang === 'es' ? 'es' : 'en']) + ' · ' + (draft.plate || '—')} />
      <Row label={t('Documentos', 'Documents')} value={docCount + '/5 ' + t('cargados', 'uploaded')} />
      <Row label={t('Zonas', 'Zones')} value={draft.zones.map(z => zoneById(z)?.es).join(', ') || '—'} />
      <Row label={t('Disponibilidad', 'Availability')} value={draft.days.length + ' ' + t('días', 'days') + ' · ' + draft.blocks.length + ' ' + t('franjas', 'blocks')} />
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', paddingTop: 12 }}>
        <span style={{ color: 'var(--brand-ink)', marginTop: 1 }}><Icon name="shield" size={16} /></span>
        <span style={{ fontSize: 12, color: 'var(--ink-500)', lineHeight: 1.4 }}>
          {t('Al enviar, autorizas la verificación de antecedentes y validación de documentos.',
             'By submitting, you authorize background verification and document validation.')}
        </span>
      </div>
    </div>
  );
}

Object.assign(window, { DriverOnboarding });
