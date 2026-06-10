// app.jsx — launch screen, surface switcher, fit-to-viewport stage
const { useState: useStateApp, useEffect: useEffectApp, useRef: useRefApp } = React;

// scale a fixed-size frame to fit the viewport (uses zoom — transform is suppressed on source-mapped nodes)
function FitStage({ cw, ch, children }) {
  const ref = useRefApp(null);
  const [scale, setScale] = useStateApp(1);
  useEffectApp(() => {
    const fit = () => {
      const el = ref.current; if (!el) return;
      const aw = el.clientWidth - 40, ah = el.clientHeight - 28;
      setScale(Math.max(0.2, Math.min(1, aw / cw, ah / ch)));
    };
    fit();
    window.addEventListener('resize', fit);
    let ro; if (window.ResizeObserver && ref.current) { ro = new ResizeObserver(fit); ro.observe(ref.current); }
    return () => { window.removeEventListener('resize', fit); if (ro) ro.disconnect(); };
  }, [cw, ch]);
  return (
    <div ref={ref} style={{ flex: 1, minHeight: 0, display: 'grid', placeItems: 'center', overflow: 'hidden' }}>
      <div style={{ zoom: scale }}>{children}</div>
    </div>
  );
}

function FlowStep({ icon, label, sub, last }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
      <div style={{ textAlign: 'center', width: 96 }}>
        <div style={{ width: 46, height: 46, borderRadius: 13, margin: '0 auto 9px', background: 'rgba(255,255,255,.07)',
          border: '1px solid rgba(255,255,255,.12)', display: 'grid', placeItems: 'center', color: 'var(--brand)' }}>
          <Icon name={icon} size={22} />
        </div>
        <div style={{ fontSize: 12.5, fontWeight: 600, color: '#fff' }}>{label}</div>
        <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,.45)', marginTop: 2 }}>{sub}</div>
      </div>
      {!last && <div style={{ width: 28, height: 1, borderTop: '1.5px dashed rgba(255,255,255,.2)', marginBottom: 26, flexShrink: 0 }} />}
    </div>
  );
}

function Launch() {
  const { t, setSurface } = useStore();
  return (
    <div className="scroll" style={{ height: '100%', overflowY: 'auto', background: 'var(--ink-900)', color: '#fff' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 480, opacity: .6, pointerEvents: 'none',
        background: 'radial-gradient(90% 70% at 70% -20%, oklch(0.45 0.11 168 / .55), transparent 60%)' }} />
      <div style={{ maxWidth: 1080, margin: '0 auto', padding: '40px 40px 56px', position: 'relative' }}>
        {/* nav */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 56 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: 9, background: 'var(--brand)', display: 'grid', placeItems: 'center', color: '#063' }}><Icon name="route" size={20} /></div>
            <span className="display" style={{ fontSize: 18, fontWeight: 600 }}>Sherpa<span style={{ color: 'var(--brand)' }}>LM</span></span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <span className="mono" style={{ fontSize: 11, color: 'rgba(255,255,255,.5)', letterSpacing: '.08em' }}>ÚLTIMA MILLA · BOGOTÁ</span>
            <LangToggle dark />
          </div>
        </div>

        {/* hero */}
        <div style={{ maxWidth: 720, marginBottom: 16 }}>
          <span className="eyebrow" style={{ color: 'var(--brand)' }}>{t('Prototipo interactivo', 'Interactive prototype')}</span>
          <h1 className="display" style={{ fontSize: 52, lineHeight: 1.04, letterSpacing: '-.025em', margin: '14px 0 18px' }}>
            {t('La plataforma de entrega de última milla, conectada de punta a punta.',
               'The last-mile delivery platform, connected end to end.')}
          </h1>
          <p style={{ fontSize: 17, lineHeight: 1.5, color: 'rgba(255,255,255,.7)', maxWidth: 620, margin: 0 }}>
            {t('Onboarding de conductores y vehículos, aprobación de seguridad, difusión de fletes y rastreo GPS en vivo — en dos superficies que comparten el mismo estado en tiempo real.',
               'Driver & vehicle onboarding, security approval, freight broadcasting and live GPS tracking — across two surfaces sharing the same realtime state.')}
          </p>
        </div>

        {/* connected flow */}
        <div style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: 4, margin: '46px 0 50px' }}>
          <FlowStep icon="doc" label={t('Aplica', 'Apply')} sub={t('App conductor', 'Driver app')} />
          <FlowStep icon="shield" label={t('Verifica', 'Vet')} sub={t('Seguridad', 'Security')} />
          <FlowStep icon="check" label={t('Aprueba', 'Approve')} sub="Ops" />
          <FlowStep icon="signal" label={t('Difunde', 'Broadcast')} sub={t('Flete', 'Freight')} />
          <FlowStep icon="route" label={t('Acepta', 'Accept')} sub={t('Conductor', 'Driver')} />
          <FlowStep icon="pin" label={t('Rastrea', 'Track')} sub="GPS" last />
        </div>

        {/* surface cards */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
          {[{ id: 'driver', icon: 'route', es: 'App del conductor', en: 'Driver app', ds: t('Solicitud de ingreso, documentos (licencia, SOAT, póliza), zonas, fletes en vivo y rastreo.', 'Application, documents (license, SOAT, policy), zones, live freight and tracking.'), tag: t('Empieza aquí · onboarding', 'Start here · onboarding') },
            { id: 'ops', icon: 'dashboard', es: 'Panel de operaciones', en: 'Ops dashboard', ds: t('Cola de aprobación de seguridad, mapa GPS en vivo, difusión de fletes, puntajes y reportes.', 'Security approval queue, live GPS map, freight broadcast, scoring and reporting.'), tag: t('Aprueba y difunde', 'Approve & broadcast') }].map(c => (
            <button key={c.id} onClick={() => setSurface(c.id)} style={{ textAlign: 'left', padding: 24, borderRadius: 18, border: '1px solid rgba(255,255,255,.12)',
              background: 'rgba(255,255,255,.04)', color: '#fff', transition: 'all .15s', cursor: 'pointer' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,.08)'; e.currentTarget.style.borderColor = 'var(--brand)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,.04)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,.12)'; }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
                <div style={{ width: 46, height: 46, borderRadius: 12, background: 'var(--brand)', color: '#063', display: 'grid', placeItems: 'center' }}><Icon name={c.icon} size={24} /></div>
                <span className="badge" style={{ background: 'rgba(255,255,255,.08)', color: 'var(--brand)', border: '1px solid rgba(255,255,255,.12)' }}>{c.tag}</span>
              </div>
              <h3 className="display" style={{ fontSize: 22, margin: '0 0 7px' }}>{c.es === 'App del conductor' ? t(c.es, c.en) : t(c.es, c.en)}</h3>
              <p style={{ fontSize: 13.5, lineHeight: 1.5, color: 'rgba(255,255,255,.6)', margin: '0 0 16px' }}>{c.ds}</p>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 14, fontWeight: 600, color: 'var(--brand)' }}>
                {t('Abrir', 'Open')} <Icon name="arrowR" size={16} />
              </span>
            </button>
          ))}
        </div>

        <div style={{ marginTop: 30, fontSize: 12.5, color: 'rgba(255,255,255,.4)', textAlign: 'center', lineHeight: 1.6 }}>
          {t('Sugerencia: completa una solicitud en la App del conductor, luego cambia a Operaciones para aprobarla y difundir un flete. El conductor aparecerá moviéndose en el mapa.',
             'Tip: complete an application in the Driver app, then switch to Ops to approve it and broadcast freight. The driver will appear moving on the map.')}
        </div>
      </div>
    </div>
  );
}

function SurfaceSwitcher() {
  const { surface, setSurface, t } = useStore();
  if (surface === 'launch') return null;
  const items = [['launch', 'globe', t('Inicio', 'Home')], ['driver', 'route', t('Conductor', 'Driver')], ['ops', 'dashboard', 'Ops']];
  return (
    <div style={{ flexShrink: 0, display: 'flex', justifyContent: 'center', padding: '12px 0 16px' }}>
      <div style={{ display: 'flex', gap: 3, padding: 4, borderRadius: 13, background: 'var(--ink-900)', boxShadow: 'var(--shadow-lg)' }}>
        {items.map(([id, ic, lb]) => {
          const on = surface === id;
          return (
            <button key={id} onClick={() => setSurface(id)} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 14px',
              borderRadius: 9, border: 'none', background: on ? 'var(--brand)' : 'transparent', color: on ? '#063' : 'rgba(255,255,255,.6)',
              fontSize: 13, fontWeight: 600, transition: 'all .12s' }}>
              <Icon name={ic} size={16} />{lb}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// OpsApp — folded in here (Babel was dropping the standalone ops-app.jsx external script)
function OpsApp() {
  const { t } = useStore();
  const [tab, setTab] = useStateApp('dashboard');
  const meta = {
    dashboard: [t('Panel operativo', 'Operations dashboard'), t('Visibilidad en tiempo real · Bogotá', 'Real-time visibility · Bogotá')],
    map:       [t('Mapa en vivo', 'Live map'), t('Rastreo GPS de la flota', 'Fleet GPS tracking')],
    approvals: [t('Aprobaciones', 'Approvals'), t('Revisión de seguridad de conductores', 'Driver security review')],
    freight:   [t('Fletes', 'Freight'), t('Difusión y asignación de tenders', 'Broadcast & tender assignment')],
    drivers:   [t('Conductores', 'Drivers'), t('Puntaje, niveles y desempeño', 'Scoring, tiers & performance')],
  };
  const screens = { dashboard: <OpsDashboard />, map: <OpsMap />, approvals: <OpsApprovals />, freight: <OpsFreight />, drivers: <OpsDrivers /> };
  return (
    <ChromeWindow width={1200} height={780} url="ops.sherpalm.co/bogota" tabs={[{ title: 'Sherpa LM · Ops' }]}>
      <div style={{ display: 'flex', height: '100%', minHeight: 0 }}>
        <OpsSidebar tab={tab} setTab={setTab} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <OpsTopbar title={meta[tab][0]} sub={meta[tab][1]} />
          {screens[tab]}
        </div>
      </div>
    </ChromeWindow>
  );
}

function Stage() {
  const { surface } = useStore();
  if (surface === 'launch') return <div style={{ position: 'fixed', inset: 0 }}><Launch /></div>;
  return (
    <div style={{ position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column',
      background: 'radial-gradient(120% 120% at 50% 0%, oklch(0.96 0.005 250), oklch(0.92 0.008 250))' }}>
      <FitStage key={surface} cw={surface === 'driver' ? 390 : 1200} ch={surface === 'driver' ? 844 : 780}>{surface === 'driver' ? <DriverApp /> : <OpsApp />}</FitStage>
      <SurfaceSwitcher />
    </div>
  );
}

function App() {
  return (
    <SherpaProvider>
      <Stage />
      <Toasts />
    </SherpaProvider>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
