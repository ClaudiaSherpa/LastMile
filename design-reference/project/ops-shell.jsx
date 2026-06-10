// ops-shell.jsx — ops dashboard chrome (sidebar + topbar)
function OpsSidebar({ tab, setTab }) {
  const { t, applications } = useStore();
  const pending = applications.filter(a => a.status === 'in_review').length;
  const items = [
    { id: 'dashboard', icon: 'dashboard', es: 'Panel', en: 'Dashboard' },
    { id: 'map', icon: 'map', es: 'Mapa en vivo', en: 'Live map' },
    { id: 'approvals', icon: 'shield', es: 'Aprobaciones', en: 'Approvals', badge: pending },
    { id: 'freight', icon: 'freight', es: 'Fletes', en: 'Freight' },
    { id: 'drivers', icon: 'users', es: 'Conductores', en: 'Drivers' },
  ];
  return (
    <div style={{ width: 224, background: 'var(--ink-900)', color: '#fff', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
      <div style={{ padding: '20px 18px 18px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 34, height: 34, borderRadius: 9, background: 'var(--brand)', display: 'grid', placeItems: 'center', color: '#063' }}>
          <Icon name="route" size={20} />
        </div>
        <div>
          <div className="display" style={{ fontSize: 16, fontWeight: 600, lineHeight: 1 }}>Sherpa<span style={{ color: 'var(--brand)' }}>LM</span></div>
          <div className="mono" style={{ fontSize: 9.5, color: 'rgba(255,255,255,.45)', letterSpacing: '.1em', marginTop: 2 }}>OPS · BOGOTÁ</div>
        </div>
      </div>
      <div style={{ padding: '6px 12px', display: 'flex', flexDirection: 'column', gap: 3, flex: 1 }}>
        {items.map(it => {
          const on = tab === it.id;
          return (
            <button key={it.id} onClick={() => setTab(it.id)} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '10px 12px',
              borderRadius: 9, border: 'none', textAlign: 'left', background: on ? 'rgba(255,255,255,.10)' : 'transparent',
              color: on ? '#fff' : 'rgba(255,255,255,.6)', fontSize: 14, fontWeight: on ? 600 : 500, transition: 'all .12s', position: 'relative' }}>
              {on && <span style={{ position: 'absolute', left: 0, top: 9, bottom: 9, width: 3, borderRadius: 999, background: 'var(--brand)' }} />}
              <Icon name={it.icon} size={19} stroke={on ? 2.2 : 1.9} />
              <span style={{ flex: 1 }}>{t(it.es, it.en)}</span>
              {it.badge > 0 && <span style={{ background: 'var(--amber)', color: '#3a2600', fontSize: 11, fontWeight: 700,
                minWidth: 19, height: 19, borderRadius: 999, display: 'grid', placeItems: 'center', padding: '0 5px', fontFamily: 'var(--font-mono)' }}>{it.badge}</span>}
            </button>
          );
        })}
      </div>
      <div style={{ padding: 12, borderTop: '1px solid rgba(255,255,255,.08)', margin: '0 6px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 6px' }}>
          <div style={{ width: 32, height: 32, borderRadius: 999, background: 'var(--blue)', display: 'grid', placeItems: 'center', fontSize: 12, fontWeight: 700 }}>VC</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Valentina C.</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,.45)' }}>{t('Coord. Seguridad', 'Security Coord.')}</div>
          </div>
          <span style={{ color: 'rgba(255,255,255,.4)' }}><Icon name="logout" size={17} /></span>
        </div>
      </div>
    </div>
  );
}

function OpsTopbar({ title, sub }) {
  const { t } = useStore();
  return (
    <div style={{ height: 62, borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center',
      padding: '0 24px', gap: 16, background: 'var(--surface)', flexShrink: 0 }}>
      <div style={{ flex: 1 }}>
        <h1 className="display" style={{ fontSize: 19, margin: 0, lineHeight: 1.1 }}>{title}</h1>
        {sub && <div style={{ fontSize: 12.5, color: 'var(--ink-500)', marginTop: 1 }}>{sub}</div>}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--surface-2)', border: '1px solid var(--line)',
        borderRadius: 9, padding: '8px 12px', width: 230, color: 'var(--ink-400)' }}>
        <Icon name="search" size={16} />
        <input placeholder={t('Buscar conductor, placa, flete…', 'Search driver, plate, freight…')} style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: 13, flex: 1, color: 'var(--ink-900)' }} />
      </div>
      <span className="badge badge-brand"><span className="dot live-dot" />{t('Tiempo real', 'Real-time')}</span>
      <LangToggle />
    </div>
  );
}

Object.assign(window, { OpsSidebar, OpsTopbar });
