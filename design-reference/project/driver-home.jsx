// driver-home.jsx — welcome, pending review, home/tenders, active tracking
const { useState: useStateDH, useEffect: useEffectDH } = React;

// ── welcome ────────────────────────────────────────────────
function DriverWelcome({ onStart }) {
  const { t } = useStore();
  return (
    <div style={{ height: '100%', background: 'var(--ink-900)', color: '#fff', display: 'flex', flexDirection: 'column',
      paddingTop: 54, position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: 0, opacity: .5,
        background: 'radial-gradient(120% 80% at 80% -10%, oklch(0.45 0.11 168 / .6), transparent 60%)' }} />
      <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '6px 16px', position: 'relative' }}><LangToggle dark /></div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 28px', position: 'relative' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 9, marginBottom: 22 }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: 'var(--brand)', display: 'grid', placeItems: 'center', color: '#063' }}>
            <Icon name="route" size={22} />
          </div>
          <span className="display" style={{ fontSize: 21, fontWeight: 600 }}>Sherpa<span style={{ color: 'var(--brand)' }}>LM</span></span>
        </div>
        <h1 className="display" style={{ fontSize: 38, lineHeight: 1.05, margin: '0 0 16px', letterSpacing: '-.02em' }}>
          {t('Maneja tu ruta. Cobra por entrega.', 'Drive your route. Earn per drop.')}
        </h1>
        <p style={{ fontSize: 15.5, lineHeight: 1.5, color: 'rgba(255,255,255,.7)', margin: '0 0 32px', maxWidth: 320 }}>
          {t('Conviértete en conductor Sherpa para última milla. Aplica una vez, recibe fletes cerca de ti.',
             'Become a Sherpa last-mile driver. Apply once, receive freight near you.')}
        </p>
        <div style={{ display: 'flex', gap: 18, marginBottom: 34 }}>
          {[['route', t('Fletes en vivo', 'Live freight')], ['shield', t('Pago seguro', 'Secure pay')], ['star', t('Prioridad Élite', 'Elite priority')]].map(([ic, lb]) => (
            <div key={lb} style={{ textAlign: 'center', flex: 1 }}>
              <div style={{ color: 'var(--brand)', marginBottom: 5 }}><Icon name={ic} size={20} /></div>
              <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,.65)' }}>{lb}</div>
            </div>
          ))}
        </div>
      </div>
      <div style={{ padding: '0 24px calc(28px + env(safe-area-inset-bottom))', position: 'relative' }}>
        <button className="btn btn-primary btn-lg btn-block" onClick={onStart}>
          {t('Comenzar solicitud', 'Start application')}<Icon name="arrowR" size={18} />
        </button>
        <button style={{ width: '100%', marginTop: 12, background: 'transparent', border: 'none', color: 'rgba(255,255,255,.6)', fontSize: 14, fontWeight: 500 }}>
          {t('Ya tengo cuenta · Ingresar', 'I have an account · Log in')}
        </button>
      </div>
    </div>
  );
}

// ── pending security review ────────────────────────────────
function DriverPending({ appId, approved, onGoLive }) {
  const { t } = useStore();
  const checks = [
    { es: 'Identidad verificada', en: 'Identity verified', done: true },
    { es: 'Validación de documentos', en: 'Document validation', done: true },
    { es: 'SOAT y póliza vigentes', en: 'SOAT & policy valid', done: true },
    { es: 'Verificación de antecedentes', en: 'Background check', done: approved },
    { es: 'Aprobación de seguridad', en: 'Security approval', done: approved },
  ];
  return (
    <div style={{ height: '100%', background: 'var(--paper)', display: 'flex', flexDirection: 'column', paddingTop: 54 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 16px 0' }}>
        <span className="mono" style={{ fontSize: 11, color: 'var(--ink-500)', letterSpacing: '.08em' }}>SHERPA LM</span>
        <LangToggle />
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 26px' }}>
        <div style={{ width: 84, height: 84, borderRadius: 24, margin: '0 auto 22px', display: 'grid', placeItems: 'center',
          background: approved ? 'var(--brand-tint)' : 'var(--amber-tint)', color: approved ? 'var(--brand-ink)' : 'var(--amber-ink)',
          position: 'relative' }}>
          {!approved && <span style={{ position: 'absolute', inset: 0, borderRadius: 24, border: '2px solid var(--amber)', animation: 'pulse-ring 2.4s ease-out infinite' }} />}
          <Icon name={approved ? 'checkCircle' : 'shield'} size={42} />
        </div>
        <h1 className="display" style={{ fontSize: 26, textAlign: 'center', margin: '0 0 8px' }}>
          {approved ? t('¡Aprobado!', 'Approved!') : t('En revisión de seguridad', 'Under security review')}
        </h1>
        <p style={{ textAlign: 'center', fontSize: 14.5, color: 'var(--ink-500)', margin: '0 0 6px', lineHeight: 1.5 }}>
          {approved ? t('Tu cuenta está activa. Ya puedes recibir fletes en tus zonas.', 'Your account is live. You can now receive freight in your zones.')
                    : t('Nuestro equipo está validando tu solicitud. Te avisaremos en minutos.', 'Our team is validating your application. We will notify you in minutes.')}
        </p>
        <div className="mono" style={{ textAlign: 'center', fontSize: 11.5, color: 'var(--ink-400)', marginBottom: 22 }}>{appId}</div>
        <div className="card" style={{ padding: '6px 16px' }}>
          {checks.map((c, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '11px 0',
              borderBottom: i < checks.length - 1 ? '1px solid var(--line-soft)' : 'none' }}>
              <span style={{ color: c.done ? 'var(--brand-600)' : 'var(--ink-400)' }}>
                <Icon name={c.done ? 'checkCircle' : 'clock'} size={19} />
              </span>
              <span style={{ flex: 1, fontSize: 14, fontWeight: 500, color: c.done ? 'var(--ink-900)' : 'var(--ink-500)' }}>{t(c.es, c.en)}</span>
              {!c.done && <span className="badge badge-amber"><span className="dot live-dot" />{t('Procesando', 'Processing')}</span>}
            </div>
          ))}
        </div>
      </div>
      <div style={{ padding: '0 24px calc(24px + env(safe-area-inset-bottom))' }}>
        {approved
          ? <button className="btn btn-primary btn-lg btn-block" onClick={onGoLive}>{t('Empezar a recibir fletes', 'Start receiving freight')}<Icon name="arrowR" size={18} /></button>
          : <div style={{ textAlign: 'center', fontSize: 12.5, color: 'var(--ink-400)' }}>
              {t('Tip: cambia al panel de Operaciones para aprobar esta solicitud.', 'Tip: switch to the Ops panel to approve this application.')}
            </div>}
      </div>
    </div>
  );
}

// ── home + tenders ─────────────────────────────────────────
function DriverHome({ driver, onAccept }) {
  const { t, lang, freight, vehicleById, TIERS, tierForScore } = useStore();
  const tier = tierForScore(driver.score);
  const isElite = tier === 'elite' || tier === 'preferente';
  const tenders = freight.filter(f => f.status === 'available' || f.status === 'broadcasting');

  return (
    <div style={{ height: '100%', background: 'var(--paper)', display: 'flex', flexDirection: 'column', paddingTop: 54 }}>
      {/* header */}
      <div style={{ background: 'var(--ink-900)', color: '#fff', padding: '8px 20px 18px', borderRadius: '0 0 22px 22px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
            <div style={{ width: 40, height: 40, borderRadius: 999, background: 'var(--brand)', color: '#063', display: 'grid', placeItems: 'center', fontWeight: 700, fontFamily: 'var(--font-display)' }}>
              {driver.name.split(' ').map(s => s[0]).slice(0, 2).join('')}
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: 15 }}>{driver.name}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                <TierBadge score={driver.score} small />
                <span className="mono" style={{ fontSize: 11, color: 'rgba(255,255,255,.6)' }}>{driver.score} pts</span>
              </div>
            </div>
          </div>
          <LangToggle dark />
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          {[[t('Hoy', 'Today'), driver.deliveries > 0 ? '8' : '0', t('entregas', 'drops')],
            [t('Ganado', 'Earned'), driver.deliveries > 0 ? '$142k' : '$0', 'COP'],
            [t('Aceptación', 'Accept'), driver.accept + '%', '']].map(([a, b, c]) => (
            <div key={a} style={{ flex: 1, background: 'rgba(255,255,255,.07)', borderRadius: 12, padding: '10px 12px' }}>
              <div className="mono" style={{ fontSize: 10, color: 'rgba(255,255,255,.55)', textTransform: 'uppercase', letterSpacing: '.06em' }}>{a}</div>
              <div className="display" style={{ fontSize: 19, fontWeight: 600, marginTop: 2 }}>{b}</div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,.45)' }}>{c}</div>
            </div>
          ))}
        </div>
      </div>

      {/* tenders */}
      <div className="scroll" style={{ flex: 1, overflowY: 'auto', padding: '18px 18px 24px' }}>
        {isElite && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '10px 13px', background: 'var(--brand-tint)',
            borderRadius: 11, marginBottom: 16, border: '1px solid var(--brand)' }}>
            <span style={{ color: 'var(--brand-ink)' }}><Icon name="star" size={17} /></span>
            <span style={{ fontSize: 12.5, color: 'var(--brand-ink)', fontWeight: 600 }}>
              {t('Prioridad Élite activa · ves los fletes 15 s antes', 'Elite priority on · you see freight 15 s early')}
            </span>
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <h2 className="display" style={{ fontSize: 18, margin: 0 }}>{t('Fletes disponibles', 'Available freight')}</h2>
          <span className="badge badge-brand"><span className="dot live-dot" />{tenders.length} {t('en vivo', 'live')}</span>
        </div>
        {tenders.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--ink-400)' }}>
            <Icon name="signal" size={30} /><div style={{ marginTop: 8, fontSize: 14 }}>{t('Esperando fletes…', 'Waiting for freight…')}</div>
          </div>
        )}
        <div style={{ display: 'grid', gap: 12 }}>
          {tenders.map(f => <TenderCard key={f.id} f={f} onAccept={() => onAccept(f)} />)}
        </div>
      </div>
    </div>
  );
}

function TenderCard({ f, onAccept }) {
  const { t, lang, zoneById, vehicleById } = useStore();
  const isNew = f.status === 'broadcasting';
  return (
    <div className="card fade-up" style={{ padding: 15, borderColor: f.priority ? 'var(--amber)' : 'var(--line)',
      boxShadow: isNew ? '0 0 0 3px var(--brand-tint)' : 'var(--shadow-sm)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 3 }}>
            <span className="mono" style={{ fontSize: 11, color: 'var(--ink-400)' }}>{f.id}</span>
            {f.priority && <span className="badge badge-amber">{t('Prioritario', 'Priority')}</span>}
            {isNew && <span className="badge badge-brand"><span className="dot live-dot" />{t('NUEVO', 'NEW')}</span>}
          </div>
          <div style={{ fontWeight: 600, fontSize: 15 }}>{f.client}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div className="display" style={{ fontSize: 20, fontWeight: 600, color: 'var(--brand-ink)' }}>{cop(f.payout)}</div>
          <div className="mono" style={{ fontSize: 10.5, color: 'var(--ink-400)' }}>COP</div>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 13 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, flex: 1 }}>
          <span style={{ width: 9, height: 9, borderRadius: 999, background: 'var(--ink-700)', flexShrink: 0 }} />
          <span style={{ fontSize: 13, fontWeight: 600 }}>{zoneById(f.pickup)?.es}</span>
          <span style={{ flex: 1, height: 1, borderTop: '1.5px dashed var(--line)' }} />
          <Icon name="pin" size={15} style={{ color: 'var(--brand-600)' }} />
          <span style={{ fontSize: 13, fontWeight: 600 }}>{zoneById(f.drop)?.es}</span>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 14, marginBottom: 14 }}>
        {[[ 'route', f.distance], ['clock', f.window], ['freight', f.weight], [vehicleIcon(f.vehicle), lang === 'es' ? vehicleById(f.vehicle)?.es : vehicleById(f.vehicle)?.en]].map(([ic, v], i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--ink-500)' }}>
            <Icon name={ic} size={15} /><span style={{ fontSize: 12.5, fontWeight: 500 }}>{v}</span>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 9 }}>
        <button className="btn btn-ghost" style={{ flex: '0 0 auto' }}>{t('Detalles', 'Details')}</button>
        <button className="btn btn-primary" style={{ flex: 1 }} onClick={onAccept}>{t('Aceptar flete', 'Accept tender')}<Icon name="check" size={16} stroke={3} /></button>
      </div>
    </div>
  );
}

// ── active delivery / tracking ─────────────────────────────
function DriverActive({ driver, tender, onComplete }) {
  const { t, lang, zoneById } = useStore();
  const pct = Math.round((driver.prog || 0) * 100);
  return (
    <div style={{ height: '100%', background: 'var(--paper)', display: 'flex', flexDirection: 'column', paddingTop: 0 }}>
      <div style={{ position: 'relative', flex: 1, minHeight: 0 }}>
        <MapCanvas focusYou you={driver} showZones />
        <div style={{ position: 'absolute', top: 54, left: 16, right: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="badge badge-ink"><span className="dot live-dot" />GPS · {t('en vivo', 'live')}</span>
          <span className="badge" style={{ background: '#fff', color: 'var(--ink-700)', boxShadow: 'var(--shadow)' }}>{driver.plate}</span>
        </div>
      </div>
      {/* sheet */}
      <div style={{ background: 'var(--surface)', borderRadius: '22px 22px 0 0', boxShadow: '0 -8px 30px rgba(16,24,40,.12)',
        padding: '14px 20px calc(18px + env(safe-area-inset-bottom))', marginTop: -22, position: 'relative', zIndex: 5 }}>
        <div style={{ width: 38, height: 4, borderRadius: 999, background: 'var(--line)', margin: '0 auto 14px' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div>
            <div className="eyebrow">{tender?.id} · {tender?.client}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
              <span style={{ fontWeight: 600, fontSize: 15 }}>{zoneById(tender?.pickup)?.es}</span>
              <Icon name="arrowR" size={15} style={{ color: 'var(--ink-400)' }} />
              <span style={{ fontWeight: 600, fontSize: 15, color: 'var(--brand-ink)' }}>{zoneById(tender?.drop)?.es}</span>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div className="display" style={{ fontSize: 22, fontWeight: 600 }}>{Math.max(2, 18 - Math.round(pct / 7))}</div>
            <div className="mono" style={{ fontSize: 10, color: 'var(--ink-400)' }}>min ETA</div>
          </div>
        </div>
        <div className="track" style={{ marginBottom: 16 }}><span style={{ width: pct + '%' }} /></div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-ghost" style={{ flex: '0 0 auto' }}><Icon name="bell" size={17} /></button>
          <button className="btn btn-primary btn-lg" style={{ flex: 1 }} onClick={onComplete}>
            {pct > 80 ? t('Confirmar entrega', 'Confirm delivery') : t('Navegar', 'Navigate')}<Icon name={pct > 80 ? 'check' : 'arrowR'} size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { DriverWelcome, DriverPending, DriverHome, DriverActive });
