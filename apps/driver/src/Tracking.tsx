import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { api } from './lib/api';
import { useI18n } from './lib/i18n';

const BOGOTA = { minLng: -74.2, maxLng: -74.0, minLat: 4.55, maxLat: 4.78 };
const toXY = (lng: number, lat: number) => ({
  x: Math.max(4, Math.min(96, ((lng - BOGOTA.minLng) / (BOGOTA.maxLng - BOGOTA.minLng)) * 100)),
  y: Math.max(4, Math.min(96, (1 - (lat - BOGOTA.minLat) / (BOGOTA.maxLat - BOGOTA.minLat)) * 100)),
});

const STEPS = ['assigned', 'en_route_pickup', 'picked_up', 'en_route', 'delivered'];
const LABEL: Record<string, [string, string]> = {
  assigned: ['Asignado', 'Assigned'],
  en_route_pickup: ['En camino a recoger', 'Heading to pickup'],
  picked_up: ['Recogido', 'Picked up'],
  en_route: ['En camino', 'On the way'],
  delivered: ['Entregado', 'Delivered'],
};

/** Public consignee tracking page (opened via the tracking link, no account). */
export function Tracking({ token }: { token: string }) {
  const { t, lang, setLang } = useI18n();
  const [data, setData] = useState<any>(null);
  const [pos, setPos] = useState<{ lng: number; lat: number } | null>(null);
  const [err, setErr] = useState('');
  const sock = useRef<Socket | null>(null);

  useEffect(() => {
    let alive = true;
    api.track(token)
      .then((d) => {
        if (!alive) return;
        setData(d);
        if (d.driver?.lng != null) setPos({ lng: d.driver.lng, lat: d.driver.lat });
        const s = io({ path: '/socket.io', transports: ['websocket', 'polling'] });
        sock.current = s;
        s.on('connect', () => s.emit('join', { room: `delivery:${d.id}` }));
        s.on('driver.location', (p: any) => setPos({ lng: p.lng, lat: p.lat }));
        s.on('delivery.updated', (p: any) => setData((cur: any) => ({ ...cur, status: p.status, timeline: p.timeline })));
      })
      .catch((e) => setErr(e.message));
    return () => { alive = false; sock.current?.disconnect(); };
  }, [token]);

  if (err) return <Center>{t('Enlace de seguimiento no válido', 'Invalid tracking link')}</Center>;
  if (!data) return <Center>…</Center>;

  const idx = STEPS.indexOf(data.status);
  const xy = pos ? toXY(pos.lng, pos.lat) : null;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--paper)' }}>
      <div style={{ maxWidth: 480, margin: '0 auto', padding: 0, minHeight: '100vh', background: 'var(--surface)', boxShadow: 'var(--shadow-lg)' }}>
        <div style={{ padding: '20px 22px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--line)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: 'var(--brand)' }} />
            <span className="display" style={{ fontSize: 16, fontWeight: 600 }}>Sherpa<span style={{ color: 'var(--brand-600)' }}>LM</span></span>
          </div>
          <button onClick={() => setLang(lang === 'es' ? 'en' : 'es')} className="mono" style={{ border: '1px solid var(--line)', background: 'var(--surface)', borderRadius: 7, padding: '4px 10px', fontSize: 11, fontWeight: 600 }}>{lang.toUpperCase()}</button>
        </div>

        {/* map */}
        <div className="map-grid" style={{ position: 'relative', height: 280 }}>
          {xy && (
            <div style={{ position: 'absolute', left: `${xy.x}%`, top: `${xy.y}%`, transform: 'translate(-50%,-50%)', transition: 'left 1.2s linear, top 1.2s linear' }}>
              <div style={{ position: 'absolute', inset: -10, borderRadius: 99, background: 'var(--brand)', opacity: 0.25, animation: 'pulse-ring 1.8s ease-out infinite' }} />
              <div style={{ width: 16, height: 16, borderRadius: 99, background: 'var(--brand)', border: '3px solid #fff', boxShadow: 'var(--shadow)' }} />
            </div>
          )}
        </div>

        <div style={{ padding: '22px' }}>
          <span className="eyebrow">{data.freight.reference}</span>
          <h1 className="display" style={{ fontSize: 24, margin: '6px 0 4px' }}>{t(LABEL[data.status]?.[0] || data.status, LABEL[data.status]?.[1] || data.status)}</h1>
          <p style={{ margin: '0 0 18px', color: 'var(--ink-500)', fontSize: 14 }}>
            {data.freight.pickupZone} → {data.freight.dropZone}
          </p>

          {data.driver && (
            <div className="card" style={{ padding: 14, display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--brand-tint)', display: 'grid', placeItems: 'center', fontWeight: 700, color: 'var(--brand-ink)' }}>{data.driver.firstName?.[0]}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600 }}>{data.driver.firstName}</div>
                <div className="mono" style={{ fontSize: 12, color: 'var(--ink-500)' }}>{data.driver.vehicle} · {data.driver.plate}</div>
              </div>
              <span className="badge badge-brand">{data.driver.tier}</span>
            </div>
          )}

          {/* status timeline */}
          <div style={{ display: 'grid', gap: 0 }}>
            {STEPS.map((st, i) => {
              const done = i <= idx;
              return (
                <div key={st} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <div style={{ width: 14, height: 14, borderRadius: 99, background: done ? 'var(--brand)' : 'var(--line)', border: '2px solid #fff' }} />
                    {i < STEPS.length - 1 && <div style={{ width: 2, height: 26, background: i < idx ? 'var(--brand)' : 'var(--line)' }} />}
                  </div>
                  <div style={{ paddingBottom: 12 }}>
                    <div style={{ fontSize: 14, fontWeight: done ? 600 : 400, color: done ? 'var(--ink-900)' : 'var(--ink-400)' }}>{t(LABEL[st][0], LABEL[st][1])}</div>
                    {data.timeline?.[st] && <div className="mono" style={{ fontSize: 11, color: 'var(--ink-500)' }}>{new Date(data.timeline[st]).toLocaleTimeString()}</div>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function Center({ children }: { children: React.ReactNode }) {
  return <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: 'var(--paper)', color: 'var(--ink-600)' }}>{children}</div>;
}
