// ui.jsx — shared primitives (lang toggle, toasts, badges, map canvas)
const { useStore: useStoreUI } = window;

function LangToggle({ dark = false }) {
  const { lang, setLang } = useStoreUI();
  const base = { border: 'none', background: 'transparent', padding: '5px 10px', borderRadius: 7,
    fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 600, cursor: 'pointer', letterSpacing: '.04em' };
  const wrap = { display: 'inline-flex', padding: 3, borderRadius: 9,
    background: dark ? 'rgba(255,255,255,.08)' : 'var(--surface-2)',
    border: '1px solid ' + (dark ? 'rgba(255,255,255,.10)' : 'var(--line)') };
  const on = { background: dark ? '#fff' : 'var(--ink-900)', color: dark ? 'var(--ink-900)' : '#fff' };
  const off = { color: dark ? 'rgba(255,255,255,.6)' : 'var(--ink-500)' };
  return (
    <div style={wrap}>
      <button style={{ ...base, ...(lang === 'es' ? on : off) }} onClick={() => setLang('es')}>ES</button>
      <button style={{ ...base, ...(lang === 'en' ? on : off) }} onClick={() => setLang('en')}>EN</button>
    </div>
  );
}

function Toasts() {
  const { toasts, lang } = useStoreUI();
  const color = { ok: 'var(--brand)', red: 'var(--red)', info: 'var(--blue)' };
  return (
    <div style={{ position: 'fixed', bottom: 22, left: '50%', transform: 'translateX(-50%)', zIndex: 9000,
      display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center', pointerEvents: 'none' }}>
      {toasts.map(tt => (
        <div key={tt.id} className="fade-up" style={{ display: 'flex', alignItems: 'center', gap: 10,
          background: 'var(--ink-900)', color: '#fff', padding: '11px 16px 11px 13px', borderRadius: 11,
          boxShadow: 'var(--shadow-lg)', fontSize: 14, fontWeight: 500 }}>
          <span style={{ width: 8, height: 8, borderRadius: 999, background: color[tt.kind] || color.info }} />
          {lang === 'es' ? tt.es : tt.en}
        </div>
      ))}
    </div>
  );
}

function TierBadge({ score, small }) {
  const { TIERS, tierForScore, lang } = useStoreUI();
  const tk = tierForScore(score); const t = TIERS[tk];
  return (
    <span className="badge" style={{ background: t.bg, color: t.color, fontSize: small ? 10 : 11 }}>
      {tk === 'elite' && <Icon name="star" size={11} />}
      {lang === 'es' ? t.es : t.en}
    </span>
  );
}

function StatusPill({ status }) {
  const { t } = useStoreUI();
  const map = {
    idle:       { cls: 'badge-gray',  es: 'Disponible', en: 'Available' },
    enroute:    { cls: 'badge-blue',  es: 'En ruta',    en: 'En route' },
    delivering: { cls: 'badge-brand', es: 'Entregando', en: 'Delivering' },
  };
  const m = map[status] || map.idle;
  return <span className={'badge ' + m.cls}><span className="dot live-dot" />{t(m.es, m.en)}</span>;
}

function VehicleGlyph({ id, size = 44, tone = 'ink' }) {
  const bg = tone === 'brand' ? 'var(--brand-tint)' : 'var(--surface-2)';
  const fg = tone === 'brand' ? 'var(--brand-ink)' : 'var(--ink-700)';
  return (
    <div style={{ width: size, height: size, borderRadius: 11, background: bg, color: fg,
      display: 'grid', placeItems: 'center', border: '1px solid var(--line)', flexShrink: 0 }}>
      <Icon name={vehicleIcon(id)} size={size * 0.5} stroke={1.8} />
    </div>
  );
}

// ── shared schematic map ────────────────────────────────────
const STATUS_COLOR = { idle: 'var(--ink-400)', enroute: 'var(--blue)', delivering: 'var(--brand-600)' };

function DriverDot({ d, onClick, active }) {
  const c = STATUS_COLOR[d.status] || 'var(--ink-400)';
  const live = d.status !== 'idle';
  return (
    <div onClick={onClick} style={{ position: 'absolute', left: d.pos.x + '%', top: d.pos.y + '%',
      transform: 'translate(-50%,-50%)', cursor: onClick ? 'pointer' : 'default', zIndex: active ? 30 : 10,
      transition: 'left 1.1s linear, top 1.1s linear' }}>
      {live && <span style={{ position: 'absolute', inset: 0, margin: 'auto', width: 18, height: 18, borderRadius: 999,
        background: c, animation: 'pulse-ring 2s ease-out infinite' }} />}
      <div style={{ position: 'relative', width: active ? 30 : 25, height: active ? 30 : 25, borderRadius: 999,
        background: '#fff', border: '2.5px solid ' + c, color: c, display: 'grid', placeItems: 'center',
        boxShadow: '0 2px 6px rgba(16,24,40,.25)' }}>
        <Icon name={vehicleIcon(d.vehicle)} size={active ? 16 : 13} stroke={2} />
      </div>
      {d.isYou && <div style={{ position: 'absolute', top: -8, left: '50%', transform: 'translateX(-50%)',
        background: 'var(--ink-900)', color: '#fff', fontSize: 8, fontFamily: 'var(--font-mono)', fontWeight: 600,
        padding: '1px 5px', borderRadius: 4, whiteSpace: 'nowrap' }}>TÚ</div>}
    </div>
  );
}

function MapCanvas({ drivers = [], height = '100%', showZones = true, onPick, activeId, focusYou, you, children }) {
  const all = focusYou && you ? [you] : drivers;
  return (
    <div className="map-grid" style={{ position: 'relative', width: '100%', height, overflow: 'hidden' }}>
      {/* arterial roads */}
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
        <path d="M8 30 L70 14 M30 18 L52 64 M60 42 L16 58 M22 40 L64 30 M47 50 L28 88 M52 64 L70 14"
          stroke="oklch(0.86 0.02 220)" strokeWidth="2.4" fill="none" strokeLinecap="round" />
        <path d="M8 30 L70 14 M30 18 L52 64 M60 42 L16 58 M22 40 L64 30 M47 50 L28 88"
          stroke="oklch(0.97 0.01 220)" strokeWidth="0.7" fill="none" strokeLinecap="round" />
      </svg>
      {/* zone labels */}
      {showZones && ZONES.map(z => (
        <div key={z.id} style={{ position: 'absolute', left: z.x + '%', top: z.y + '%', transform: 'translate(-50%,-50%)',
          pointerEvents: 'none', zIndex: 4, textAlign: 'center' }}>
          <div style={{ width: 5, height: 5, borderRadius: 999, background: 'oklch(0.78 0.02 220)', margin: '0 auto 3px' }} />
          <div className="mono" style={{ fontSize: 9, color: 'oklch(0.45 0.02 240)', fontWeight: 500, letterSpacing: '.02em' }}>{z.es}</div>
        </div>
      ))}
      {/* route trails for active drivers */}
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 6 }}>
        {all.filter(d => d.status !== 'idle' && d.route).map(d => (
          <polyline key={d.id} points={d.route.map(p => p.x + ',' + p.y).join(' ')}
            fill="none" stroke={d.isYou ? 'var(--brand)' : 'oklch(0.62 0.12 248 / .5)'} strokeWidth="1" strokeDasharray="2 2" strokeLinecap="round" />
        ))}
      </svg>
      {all.map(d => <DriverDot key={d.id} d={d} active={d.id === activeId} onClick={onPick ? () => onPick(d) : undefined} />)}
      {children}
    </div>
  );
}

// money format
const cop = (n) => '$' + n.toLocaleString('es-CO');

Object.assign(window, { LangToggle, Toasts, TierBadge, StatusPill, VehicleGlyph, MapCanvas, DriverDot, cop, STATUS_COLOR });
