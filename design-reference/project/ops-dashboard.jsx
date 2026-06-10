// ops-dashboard.jsx — reporting & realtime visibility
const { useMemo: useMemoOD } = React;

function KpiCard({ icon, label, value, unit, delta, tone = 'ink', live }) {
  const toneC = { brand: 'var(--brand-ink)', blue: 'var(--blue-ink)', amber: 'var(--amber-ink)', ink: 'var(--ink-700)' }[tone];
  const toneBg = { brand: 'var(--brand-tint)', blue: 'var(--blue-tint)', amber: 'var(--amber-tint)', ink: 'var(--surface-2)' }[tone];
  return (
    <div className="card" style={{ padding: 16, flex: 1 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <div style={{ width: 36, height: 36, borderRadius: 9, background: toneBg, color: toneC, display: 'grid', placeItems: 'center' }}>
          <Icon name={icon} size={19} />
        </div>
        {live && <span className="badge badge-brand" style={{ fontSize: 10 }}><span className="dot live-dot" />LIVE</span>}
        {delta && !live && <span className="badge badge-gray" style={{ fontSize: 10 }}>{delta}</span>}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
        <span className="display" style={{ fontSize: 27, fontWeight: 600 }}>{value}</span>
        {unit && <span className="mono" style={{ fontSize: 12, color: 'var(--ink-400)' }}>{unit}</span>}
      </div>
      <div style={{ fontSize: 12.5, color: 'var(--ink-500)', marginTop: 2 }}>{label}</div>
    </div>
  );
}

function HourBars() {
  const { t, kpiTick } = useStore();
  const data = useMemoOD(() => {
    const base = [22, 31, 28, 44, 52, 61, 78, 96, 88, 74, 66, 58];
    return base.map(v => v + Math.round(Math.sin((kpiTick + v) / 3) * 4));
  }, [Math.floor(kpiTick / 4)]);
  const max = Math.max(...data);
  const hours = ['8','9','10','11','12','13','14','15','16','17','18','19'];
  return (
    <div className="card" style={{ padding: 18, flex: 2 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
        <div>
          <h3 className="display" style={{ fontSize: 15, margin: 0 }}>{t('Entregas por hora', 'Deliveries per hour')}</h3>
          <div style={{ fontSize: 12, color: 'var(--ink-500)', marginTop: 1 }}>{t('Hoy · actualizando en vivo', 'Today · updating live')}</div>
        </div>
        <span className="badge badge-brand"><span className="dot live-dot" />{t('En vivo', 'Live')}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 130 }}>
        {data.map((v, i) => (
          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
            <div style={{ width: '100%', height: (v / max) * 110, background: i === 7 ? 'var(--brand)' : 'var(--brand-tint)',
              borderRadius: '5px 5px 0 0', transition: 'height .6s cubic-bezier(.2,.7,.2,1)', position: 'relative' }}>
              {i === 7 && <span className="mono" style={{ position: 'absolute', top: -18, left: '50%', transform: 'translateX(-50%)', fontSize: 10, fontWeight: 600, color: 'var(--brand-ink)' }}>{v}</span>}
            </div>
            <span className="mono" style={{ fontSize: 10, color: 'var(--ink-400)' }}>{hours[i]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function TierDonut() {
  const { t, drivers, youDriver, tierForScore, TIERS, lang } = useStore();
  const all = youDriver ? [...drivers, youDriver] : drivers;
  const counts = { elite: 0, preferente: 0, estandar: 0, nuevo: 0 };
  all.forEach(d => counts[tierForScore(d.score)]++);
  const total = all.length || 1;
  const colors = { elite: 'var(--brand)', preferente: 'var(--blue)', estandar: 'var(--ink-400)', nuevo: 'var(--amber)' };
  let acc = 0;
  const segs = Object.entries(counts).map(([k, v]) => { const frac = v / total; const s = acc; acc += frac; return { k, v, frac, s }; });
  const R = 52, C = 2 * Math.PI * R;
  return (
    <div className="card" style={{ padding: 18, flex: 1 }}>
      <h3 className="display" style={{ fontSize: 15, margin: '0 0 16px' }}>{t('Conductores por nivel', 'Drivers by tier')}</h3>
      <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
        <svg width="124" height="124" viewBox="0 0 124 124" style={{ flexShrink: 0 }}>
          <circle cx="62" cy="62" r={R} fill="none" stroke="var(--line)" strokeWidth="14" />
          {segs.map(sg => (
            <circle key={sg.k} cx="62" cy="62" r={R} fill="none" stroke={colors[sg.k]} strokeWidth="14"
              strokeDasharray={`${sg.frac * C} ${C}`} strokeDashoffset={-sg.s * C}
              transform="rotate(-90 62 62)" style={{ transition: 'stroke-dasharray .6s' }} strokeLinecap="butt" />
          ))}
          <text x="62" y="58" textAnchor="middle" className="display" style={{ fontSize: 22, fontWeight: 600, fill: 'var(--ink-900)' }}>{total}</text>
          <text x="62" y="74" textAnchor="middle" className="mono" style={{ fontSize: 9, fill: 'var(--ink-400)' }}>{t('activos', 'active')}</text>
        </svg>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 9 }}>
          {segs.map(sg => (
            <div key={sg.k} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 9, height: 9, borderRadius: 3, background: colors[sg.k] }} />
              <span style={{ flex: 1, fontSize: 12.5, color: 'var(--ink-700)' }}>{lang === 'es' ? TIERS[sg.k].es : TIERS[sg.k].en}</span>
              <span className="mono" style={{ fontSize: 12, fontWeight: 600 }}>{sg.v}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ZoneActivity() {
  const { t, drivers, youDriver, zoneById, kpiTick } = useStore();
  const all = youDriver ? [...drivers, youDriver] : drivers;
  const byZone = {};
  all.forEach(d => { byZone[d.zone] = (byZone[d.zone] || 0) + 1; });
  const rows = ['chapinero','usaquen','kennedy','suba','teusaquillo'].map(z => ({
    z, drivers: byZone[z] || 0, demand: 40 + Math.round(Math.abs(Math.sin((kpiTick + z.length) / 5)) * 55),
  }));
  return (
    <div className="card" style={{ padding: 18, flex: 1 }}>
      <h3 className="display" style={{ fontSize: 15, margin: '0 0 4px' }}>{t('Demanda por zona', 'Demand by zone')}</h3>
      <div style={{ fontSize: 12, color: 'var(--ink-500)', marginBottom: 14 }}>{t('Índice de fletes vs. cobertura', 'Freight index vs. coverage')}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
        {rows.map(r => (
          <div key={r.z}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
              <span style={{ fontSize: 13, fontWeight: 500 }}>{zoneById(r.z)?.es}</span>
              <span className="mono" style={{ fontSize: 11.5, color: r.demand > 80 ? 'var(--red-ink)' : 'var(--ink-500)' }}>
                {r.drivers} {t('cond.', 'drv')} · {r.demand}%
              </span>
            </div>
            <div className="track"><span style={{ width: r.demand + '%', background: r.demand > 80 ? 'var(--amber)' : 'var(--brand)' }} /></div>
          </div>
        ))}
      </div>
    </div>
  );
}

function OpsDashboard() {
  const { t, drivers, youDriver, freight, kpiTick } = useStore();
  const all = youDriver ? [...drivers, youDriver] : drivers;
  const online = all.length;
  const active = all.filter(d => d.status !== 'idle').length;
  const onTime = Math.round(all.reduce((s, d) => s + d.onTime, 0) / all.length);
  const eta = 12 + (kpiTick % 5);
  const broadcasting = freight.filter(f => f.status === 'broadcasting').length;
  return (
    <div className="scroll" style={{ flex: 1, overflowY: 'auto', padding: 24, background: 'var(--paper)' }}>
      <div style={{ display: 'flex', gap: 14, marginBottom: 16 }}>
        <KpiCard icon="users" label={t('Conductores en línea', 'Drivers online')} value={online} tone="brand" live />
        <KpiCard icon="route" label={t('Entregas activas', 'Active deliveries')} value={active} tone="blue" live />
        <KpiCard icon="clock" label={t('ETA promedio', 'Avg ETA')} value={eta} unit="min" tone="ink" delta="−4%" />
        <KpiCard icon="checkCircle" label={t('A tiempo', 'On-time')} value={onTime} unit="%" tone="brand" delta="+2%" />
        <KpiCard icon="signal" label={t('En difusión', 'Broadcasting')} value={broadcasting} tone="amber" live={broadcasting > 0} />
      </div>
      <div style={{ display: 'flex', gap: 14, marginBottom: 16, alignItems: 'stretch' }}>
        <HourBars />
        <TierDonut />
      </div>
      <div style={{ display: 'flex', gap: 14, alignItems: 'stretch' }}>
        <ZoneActivity />
        <div className="card" style={{ padding: 0, flex: 1.3, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '16px 18px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 className="display" style={{ fontSize: 15, margin: 0 }}>{t('Mapa operativo', 'Operations map')}</h3>
            <span className="badge badge-gray">{active} {t('en ruta', 'en route')}</span>
          </div>
          <div style={{ flex: 1, minHeight: 220 }}>
            <MapCanvas drivers={all} showZones />
          </div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { OpsDashboard });
