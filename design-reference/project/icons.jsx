// icons.jsx — line icon set (stroke, currentColor)
function Icon({ name, size = 20, stroke = 2, style }) {
  const p = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none',
    stroke: 'currentColor', strokeWidth: stroke, strokeLinecap: 'round', strokeLinejoin: 'round', style };
  const G = {
    dashboard: <><rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/></>,
    map: <><path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2Z"/><path d="M9 4v14M15 6v14"/></>,
    shield: <><path d="M12 3 5 6v5c0 4.2 2.9 8 7 10 4.1-2 7-5.8 7-10V6l-7-3Z"/><path d="m9 12 2 2 4-4"/></>,
    freight: <><path d="M3 7h11v9H3zM14 10h4l3 3v3h-7"/><circle cx="7" cy="18" r="1.8"/><circle cx="17.5" cy="18" r="1.8"/></>,
    users: <><circle cx="9" cy="8" r="3.2"/><path d="M3.5 19c.6-3 2.9-4.6 5.5-4.6S14 16 14.5 19"/><path d="M16 5.2a3 3 0 0 1 0 5.6M16.5 14.6c2.2.3 3.7 1.8 4 4.4"/></>,
    pin: <><path d="M12 21s7-5.5 7-11a7 7 0 1 0-14 0c0 5.5 7 11 7 11Z"/><circle cx="12" cy="10" r="2.6"/></>,
    bell: <><path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6Z"/><path d="M10 19a2 2 0 0 0 4 0"/></>,
    doc: <><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z"/><path d="M14 3v5h5"/><path d="M9 13h6M9 17h4"/></>,
    check: <path d="m5 12.5 4.5 4.5L19 7"/>,
    checkCircle: <><circle cx="12" cy="12" r="9"/><path d="m8 12 2.5 2.5L16 9"/></>,
    x: <path d="M6 6l12 12M18 6 6 18"/>,
    xCircle: <><circle cx="12" cy="12" r="9"/><path d="M9 9l6 6M15 9l-6 6"/></>,
    clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/></>,
    alert: <><path d="M12 3 2.5 20h19L12 3Z"/><path d="M12 10v4M12 17h.01"/></>,
    search: <><circle cx="11" cy="11" r="6.5"/><path d="m21 21-4.3-4.3"/></>,
    chevR: <path d="m9 5 7 7-7 7"/>,
    chevL: <path d="m15 5-7 7 7 7"/>,
    chevD: <path d="m5 9 7 7 7-7"/>,
    arrowR: <><path d="M5 12h14"/><path d="m13 5 7 7-7 7"/></>,
    plus: <path d="M12 5v14M5 12h14"/>,
    upload: <><path d="M12 16V5"/><path d="m7 9 5-5 5 5"/><path d="M5 19h14"/></>,
    camera: <><path d="M4 8h3l1.5-2h7L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z"/><circle cx="12" cy="13" r="3.2"/></>,
    signal: <><path d="M4 20v-5M9 20v-9M14 20v-13M19 20V6"/></>,
    star: <path d="m12 3 2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 16.6 6.8 19.2l1-5.9L3.5 9.2l5.9-.8Z"/>,
    route: <><circle cx="6" cy="6" r="2.4"/><circle cx="18" cy="18" r="2.4"/><path d="M8.2 6H15a3 3 0 0 1 0 6H9a3 3 0 0 0 0 6h6.6"/></>,
    moto: <><circle cx="5.5" cy="17" r="2.6"/><circle cx="18.5" cy="17" r="2.6"/><path d="M5.5 17h7l3.5-6h-4l-2-3H6"/><path d="M14 6h3"/></>,
    carro: <><path d="M3 13l2-5h11l3 5"/><path d="M3 13h18v4H3z"/><circle cx="7" cy="17.5" r="1.6"/><circle cx="17" cy="17.5" r="1.6"/></>,
    van: <><path d="M3 7h12v9H3zM15 9h3l3 3.5V16h-6"/><circle cx="7" cy="17.5" r="1.6"/><circle cx="17.5" cy="17.5" r="1.6"/></>,
    camioneta: <><path d="M3 9h8v6H3zM11 11h4l2 4h4M11 15h10"/><circle cx="7" cy="17" r="1.6"/><circle cx="18" cy="17" r="1.6"/></>,
    bici: <><circle cx="6" cy="17" r="3"/><circle cx="18" cy="17" r="3"/><path d="M6 17 10 8h5l-3 9M10 8h-2M15 8l2.5 9M12 8h4"/></>,
    globe: <><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.5 2.5 15 0 18M12 3c-2.5 2.5-2.5 15 0 18"/></>,
    logout: <><path d="M14 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2v-2"/><path d="M10 12h10m0 0-3-3m3 3-3 3"/></>,
    menu: <path d="M4 7h16M4 12h16M4 17h16"/>,
    filter: <path d="M3 5h18l-7 8v6l-4-2v-4L3 5Z"/>,
    chart: <><path d="M4 4v16h16"/><path d="m7 14 3-4 3 2 4-6"/></>,
    play: <path d="M7 5v14l11-7-11-7Z"/>,
    money: <><rect x="2.5" y="6" width="19" height="12" rx="2"/><circle cx="12" cy="12" r="2.6"/><path d="M6 9v6M18 9v6"/></>,
  };
  return <svg {...p}>{G[name] || null}</svg>;
}
const vehicleIcon = (id) => ({ moto: 'moto', carro: 'carro', van: 'van', camioneta: 'camioneta', bici: 'bici' }[id] || 'carro');
Object.assign(window, { Icon, vehicleIcon });
