import { useEffect, useState } from 'react';

type Lang = 'es' | 'en';

/**
 * Driver PWA — Phase 1 welcome shell. The full 7-step onboarding wizard
 * (rendered from the configurable DocumentType set) lands in Phase 2.
 */
export function App() {
  const [lang, setLang] = useState<Lang>('es');
  const [online, setOnline] = useState<boolean | null>(null);
  const t = (es: string, en: string) => (lang === 'es' ? es : en);

  useEffect(() => {
    fetch('/api/health')
      .then((r) => r.ok)
      .then(setOnline)
      .catch(() => setOnline(false));
  }, []);

  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: 'var(--ink-900)', color: '#fff' }}>
      <div style={{ position: 'fixed', inset: 0, opacity: 0.55, pointerEvents: 'none',
        background: 'radial-gradient(90% 60% at 70% -10%, oklch(0.45 0.11 168 / .55), transparent 60%)' }} />
      {/* phone frame */}
      <div style={{ width: 390, maxWidth: '94vw', minHeight: 720, borderRadius: 36, background: 'var(--paper)', color: 'var(--ink-900)',
        boxShadow: 'var(--shadow-lg)', overflow: 'hidden', position: 'relative', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '54px 26px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <div style={{ width: 30, height: 30, borderRadius: 8, background: 'var(--brand)' }} />
            <span className="display" style={{ fontSize: 17, fontWeight: 600 }}>Sherpa<span style={{ color: 'var(--brand-600)' }}>LM</span></span>
          </div>
          <div style={{ display: 'flex', gap: 2, padding: 3, borderRadius: 8, background: 'var(--surface-2)', border: '1px solid var(--line)' }}>
            {(['es', 'en'] as Lang[]).map((l) => (
              <button key={l} onClick={() => setLang(l)} className="mono"
                style={{ border: 'none', borderRadius: 6, padding: '3px 9px', fontSize: 11, fontWeight: 600,
                  background: lang === l ? 'var(--ink-900)' : 'transparent', color: lang === l ? '#fff' : 'var(--ink-500)' }}>
                {l.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        <div style={{ padding: '40px 26px', flex: 1, display: 'flex', flexDirection: 'column' }}>
          <span className="eyebrow" style={{ color: 'var(--brand-ink)' }}>{t('Conductor', 'Driver')}</span>
          <h1 className="display" style={{ fontSize: 34, lineHeight: 1.08, margin: '12px 0 14px' }}>
            {t('Conduce con Sherpa en Bogotá.', 'Drive with Sherpa in Bogotá.')}
          </h1>
          <p style={{ fontSize: 15.5, lineHeight: 1.5, color: 'var(--ink-600)', margin: 0 }}>
            {t('Completa tu solicitud con licencia, SOAT, póliza y tarjeta de propiedad. Tras la revisión de seguridad empiezas a recibir fletes.',
               'Complete your application with license, SOAT, policy and registration. After security review you start receiving freight.')}
          </p>

          <div style={{ marginTop: 'auto', display: 'grid', gap: 12 }}>
            <button className="btn btn-primary btn-lg btn-block" disabled>
              {t('Comenzar solicitud', 'Start application')}
            </button>
            <div style={{ textAlign: 'center', fontSize: 12.5, color: 'var(--ink-500)' }}>
              {t('El onboarding llega en la Fase 2', 'Onboarding arrives in Phase 2')}
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 7, alignItems: 'center', fontSize: 12 }}>
              <span style={{ width: 8, height: 8, borderRadius: 99, background: online ? 'var(--brand)' : online === false ? 'var(--red)' : 'var(--ink-400)' }} className={online ? 'live-dot' : ''} />
              <span className="mono" style={{ color: 'var(--ink-500)' }}>
                {online == null ? t('Conectando…', 'Connecting…') : online ? t('API conectada', 'API connected') : t('API sin conexión', 'API offline')}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
