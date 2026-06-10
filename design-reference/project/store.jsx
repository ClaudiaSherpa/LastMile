// store.jsx — shared state, bilingual i18n, realtime simulation
const { createContext, useContext, useState, useEffect, useRef, useCallback } = React;

const SherpaCtx = createContext(null);
const useStore = () => useContext(SherpaCtx);

// ── geography (local map space 0..100) ──────────────────────
const ZONES = [
  { id: 'usaquen',    es: 'Usaquén',     x: 70, y: 14 },
  { id: 'suba',       es: 'Suba',        x: 30, y: 18 },
  { id: 'chico',      es: 'Chicó',       x: 64, y: 30 },
  { id: 'chapinero',  es: 'Chapinero',   x: 60, y: 42 },
  { id: 'teusaquillo',es: 'Teusaquillo', x: 47, y: 50 },
  { id: 'engativa',   es: 'Engativá',    x: 22, y: 40 },
  { id: 'fontibon',   es: 'Fontibón',    x: 16, y: 58 },
  { id: 'centro',     es: 'Centro',      x: 52, y: 64 },
  { id: 'kennedy',    es: 'Kennedy',     x: 28, y: 74 },
  { id: 'bosa',       es: 'Bosa',        x: 18, y: 88 },
];
const zoneById = (id) => ZONES.find(z => z.id === id);

const VEHICLES = [
  { id: 'moto',   es: 'Motocicleta', en: 'Motorcycle', cap: 'Hasta 15 kg',  capEn: 'Up to 15 kg' },
  { id: 'carro',  es: 'Automóvil',   en: 'Car',        cap: 'Hasta 80 kg',  capEn: 'Up to 80 kg' },
  { id: 'van',    es: 'Van',         en: 'Van',        cap: 'Hasta 600 kg', capEn: 'Up to 600 kg' },
  { id: 'camioneta', es: 'Camioneta', en: 'Pickup',    cap: 'Hasta 1.2 t',  capEn: 'Up to 1.2 t' },
  { id: 'bici',   es: 'Bicicleta',   en: 'Bicycle',    cap: 'Hasta 8 kg',   capEn: 'Up to 8 kg' },
];
const vehicleById = (id) => VEHICLES.find(v => v.id === id);

const TIERS = {
  elite:     { es: 'Élite',      en: 'Elite',    color: 'var(--brand-ink)', bg: 'var(--brand-tint)', min: 92 },
  preferente:{ es: 'Preferente', en: 'Preferred',color: 'var(--blue-ink)',  bg: 'var(--blue-tint)',  min: 80 },
  estandar:  { es: 'Estándar',   en: 'Standard', color: 'var(--ink-600)',   bg: 'var(--surface-2)',  min: 60 },
  nuevo:     { es: 'Nuevo',      en: 'New',      color: 'var(--amber-ink)', bg: 'var(--amber-tint)', min: 0 },
};
const tierForScore = (s) => s >= 92 ? 'elite' : s >= 80 ? 'preferente' : s >= 60 ? 'estandar' : 'nuevo';

const route = (pts) => pts.map(id => zoneById(id)).map(z => ({ x: z.x, y: z.y }));

// ── seed data ───────────────────────────────────────────────
const seedDrivers = () => ([
  { id: 'd-aurelio', name: 'Aurelio Quintero', vehicle: 'moto', plate: 'KXR-21F', score: 96, status: 'enroute',
    pos: { x: 60, y: 42 }, route: route(['chapinero','chico','usaquen']), prog: 0.2, zone: 'chapinero', deliveries: 1284, accept: 98, onTime: 99 },
  { id: 'd-marisol', name: 'Marisol Vega', vehicle: 'carro', plate: 'GHT-845', score: 88, status: 'delivering',
    pos: { x: 47, y: 50 }, route: route(['teusaquillo','centro','kennedy']), prog: 0.55, zone: 'teusaquillo', deliveries: 642, accept: 91, onTime: 94 },
  { id: 'd-bernardo', name: 'Bernardo Ruiz', vehicle: 'van', plate: 'WPL-302', score: 83, status: 'enroute',
    pos: { x: 28, y: 74 }, route: route(['kennedy','fontibon','engativa']), prog: 0.4, zone: 'kennedy', deliveries: 410, accept: 86, onTime: 89 },
  { id: 'd-camila', name: 'Camila Ardila', vehicle: 'moto', plate: 'JDR-77E', score: 74, status: 'idle',
    pos: { x: 30, y: 18 }, route: route(['suba','engativa']), prog: 0, zone: 'suba', deliveries: 188, accept: 79, onTime: 85 },
  { id: 'd-hector', name: 'Héctor Paz', vehicle: 'camioneta', plate: 'TBN-019', score: 91, status: 'idle',
    pos: { x: 70, y: 14 }, route: route(['usaquen','chico']), prog: 0, zone: 'usaquen', deliveries: 523, accept: 93, onTime: 96 },
]);

let freightSeq = 4820;
const seedFreight = () => ([
  { id: 'F-' + (freightSeq++), pickup: 'chico', drop: 'usaquen', vehicle: 'moto', weight: '6 kg',
    payout: 18400, distance: '4.2 km', window: '30 min', priority: true, status: 'available', client: 'Farmadrid', accepted: null },
  { id: 'F-' + (freightSeq++), pickup: 'teusaquillo', drop: 'kennedy', vehicle: 'carro', weight: '32 kg',
    payout: 29900, distance: '9.1 km', window: '60 min', priority: false, status: 'available', client: 'Mercaldas', accepted: null },
  { id: 'F-' + (freightSeq++), pickup: 'fontibon', drop: 'bosa', vehicle: 'van', weight: '210 kg',
    payout: 74500, distance: '12.7 km', window: '120 min', priority: false, status: 'available', client: 'Corabastos Pro', accepted: null },
]);

const seedApplications = () => ([
  { id: 'AP-7741', name: 'Lucía Granados', vehicle: 'moto', plate: 'FNK-552', zones: ['suba','engativa'],
    submitted: 'hace 2 h', submittedEn: '2 h ago', status: 'in_review', score: null, you: false,
    docs: { license: 'ok', soat: 'ok', insurance: 'ok', property: 'review', id: 'ok' },
    security: { identity: 'pass', criminal: 'pending', sanctions: 'pass', vehicle: 'pass' } },
  { id: 'AP-7742', name: 'Óscar Beltrán', vehicle: 'camioneta', plate: 'RQS-118', zones: ['kennedy','bosa','fontibon'],
    submitted: 'hace 5 h', submittedEn: '5 h ago', status: 'in_review', score: null, you: false,
    docs: { license: 'ok', soat: 'expired', insurance: 'ok', property: 'ok', id: 'ok' },
    security: { identity: 'pass', criminal: 'pass', sanctions: 'flag', vehicle: 'pass' } },
  { id: 'AP-7740', name: 'Daniela Forero', vehicle: 'carro', plate: 'MZP-740', zones: ['chapinero','chico'],
    submitted: 'ayer', submittedEn: 'yesterday', status: 'in_review', score: null, you: false,
    docs: { license: 'ok', soat: 'ok', insurance: 'review', property: 'ok', id: 'ok' },
    security: { identity: 'pass', criminal: 'pass', sanctions: 'pass', vehicle: 'review' } },
]);

const emptyDraft = () => ({
  step: 0,
  name: '', phone: '', email: '', cedula: '',
  vehicle: '', plate: '', brand: '', model: '', year: '', color: '', capacity: '',
  docs: { license: false, soat: false, insurance: false, property: false, id: false },
  zones: [], days: [], blocks: [],
});

function SherpaProvider({ children }) {
  const [lang, setLang] = useState('es');
  const [surface, setSurface] = useState('launch'); // launch | driver | ops
  const [drivers, setDrivers] = useState(seedDrivers);
  const [freight, setFreight] = useState(seedFreight);
  const [applications, setApplications] = useState(seedApplications);
  const [draft, setDraft] = useState(emptyDraft);
  const [youDriver, setYouDriver] = useState(null);   // becomes active driver after approval
  const [toasts, setToasts] = useState([]);
  const [kpiTick, setKpiTick] = useState(0);

  const t = useCallback((es, en) => (lang === 'es' ? es : en), [lang]);

  const toast = useCallback((es, en, kind = 'info') => {
    const id = Math.random().toString(36).slice(2);
    setToasts(ts => [...ts, { id, es, en, kind }]);
    setTimeout(() => setToasts(ts => ts.filter(x => x.id !== id)), 3600);
  }, []);

  const updateDraft = useCallback((patch) => setDraft(d => ({ ...d, ...patch })), []);
  const resetDraft = useCallback(() => setDraft(emptyDraft()), []);

  const submitApplication = useCallback(() => {
    const id = 'AP-' + (7743 + applications.filter(a => a.you).length);
    const app = {
      id, name: draft.name || 'Tú / You', vehicle: draft.vehicle, plate: draft.plate || '—',
      zones: draft.zones, submitted: 'ahora', submittedEn: 'just now', status: 'in_review',
      score: null, you: true,
      docs: { license: 'ok', soat: 'ok', insurance: 'ok', property: 'ok', id: 'ok' },
      security: { identity: 'pass', criminal: 'pending', sanctions: 'pass', vehicle: 'pass' },
    };
    setApplications(a => [app, ...a]);
    return id;
  }, [draft, applications]);

  const decideApplication = useCallback((id, decision, score = 90) => {
    setApplications(apps => apps.map(a => a.id === id ? { ...a, status: decision, score: decision === 'approved' ? score : null } : a));
    const app = applications.find(a => a.id === id);
    if (decision === 'approved' && app) {
      if (app.you) {
        const z = app.zones[0] ? zoneById(app.zones[0]) : ZONES[3];
        setYouDriver({ id: 'd-you', name: app.name, vehicle: app.vehicle, plate: app.plate,
          score, status: 'idle', pos: { x: z.x, y: z.y }, route: route([app.zones[0]||'chapinero', app.zones[1]||'chico']),
          prog: 0, zone: app.zones[0]||'chapinero', deliveries: 0, accept: 100, onTime: 100, isYou: true });
      } else {
        const z = app.zones[0] ? zoneById(app.zones[0]) : ZONES[3];
        setDrivers(ds => [...ds, { id: 'd-' + id, name: app.name, vehicle: app.vehicle, plate: app.plate,
          score, status: 'idle', pos: { x: z.x, y: z.y }, route: route([app.zones[0]||'chapinero']), prog: 0,
          zone: app.zones[0]||'chapinero', deliveries: 0, accept: 100, onTime: 100 }]);
      }
      toast('Conductor aprobado y activado', 'Driver approved & activated', 'ok');
    } else if (decision === 'rejected') {
      toast('Solicitud rechazada', 'Application rejected', 'red');
    }
  }, [applications, toast]);

  const broadcastFreight = useCallback((id) => {
    setFreight(fs => fs.map(f => f.id === id ? { ...f, status: 'broadcasting' } : f));
  }, []);

  const acceptTender = useCallback((id, driverId = 'd-you') => {
    setFreight(fs => fs.map(f => f.id === id ? { ...f, status: 'assigned', accepted: driverId } : f));
    const setActive = (d) => ({ ...d, status: 'enroute', prog: 0.02 });
    if (driverId === 'd-you') setYouDriver(d => d ? setActive(d) : d);
    else setDrivers(ds => ds.map(d => d.id === driverId ? setActive(d) : d));
  }, []);

  // ── realtime sim ──────────────────────────────────────────
  useEffect(() => {
    const iv = setInterval(() => {
      const advance = (d) => {
        if (d.status === 'idle' || !d.route || d.route.length < 2) {
          // gentle jitter for idle
          return { ...d, pos: { x: d.pos.x + (Math.random()-0.5)*0.3, y: d.pos.y + (Math.random()-0.5)*0.3 } };
        }
        let prog = d.prog + 0.012 + Math.random()*0.006;
        if (prog >= 1) { prog = 0; }
        const segs = d.route.length - 1;
        const f = prog * segs; const i = Math.min(Math.floor(f), segs - 1); const local = f - i;
        const a = d.route[i], b = d.route[i+1];
        return { ...d, prog, pos: { x: a.x + (b.x-a.x)*local, y: a.y + (b.y-a.y)*local } };
      };
      setDrivers(ds => ds.map(advance));
      setYouDriver(d => d ? advance(d) : d);
      setKpiTick(k => k + 1);
    }, 1100);
    return () => clearInterval(iv);
  }, []);

  const value = {
    lang, setLang, t, surface, setSurface,
    drivers, freight, applications, draft, youDriver, toasts, kpiTick,
    updateDraft, resetDraft, submitApplication, decideApplication,
    broadcastFreight, acceptTender, toast,
    ZONES, VEHICLES, TIERS, zoneById, vehicleById, tierForScore,
  };
  return <SherpaCtx.Provider value={value}>{children}</SherpaCtx.Provider>;
}

Object.assign(window, {
  SherpaProvider, useStore,
  ZONES, VEHICLES, TIERS, zoneById, vehicleById, tierForScore,
});
