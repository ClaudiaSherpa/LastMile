import fs from 'node:fs';

const KML = process.env.KML || 'parishes/doc.kml';
const OUT = process.env.OUT || 'apps/admin/src/assets/barbados-parishes.ts';
const B = { minLng: -59.66, maxLng: -59.42, minLat: 13.04, maxLat: 13.34 };
const S = 2000;
const proj = (lng, lat) => [
  ((lng - B.minLng) / (B.maxLng - B.minLng)) * S,
  (1 - (lat - B.minLat) / (B.maxLat - B.minLat)) * S,
];

function simplify(pts, eps) {
  if (pts.length < 4) return pts;
  const sq = (a, b) => { const dx = a[0] - b[0], dy = a[1] - b[1]; return dx * dx + dy * dy; };
  const segDist = (p, a, b) => {
    let x = a[0], y = a[1], dx = b[0] - x, dy = b[1] - y;
    if (dx || dy) { const t = ((p[0] - x) * dx + (p[1] - y) * dy) / (dx * dx + dy * dy); if (t > 1) { x = b[0]; y = b[1]; } else if (t > 0) { x += dx * t; y += dy * t; } }
    return sq(p, [x, y]);
  };
  const e2 = eps * eps, keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1;
  const st = [[0, pts.length - 1]];
  while (st.length) { const [lo, hi] = st.pop(); let idx = -1, max = 0; for (let i = lo + 1; i < hi; i++) { const d = segDist(pts[i], pts[lo], pts[hi]); if (d > max) { max = d; idx = i; } } if (max > e2 && idx > 0) { keep[idx] = 1; st.push([lo, idx], [idx, hi]); } }
  return pts.filter((_, i) => keep[i]);
}

const xml = fs.readFileSync(KML, 'utf8');
const parishes = [];
const re = /<Placemark\b[\s\S]*?<\/Placemark>/g;
let m;
while ((m = re.exec(xml))) {
  const body = m[0];
  const name = (body.match(/<name>([^<]*)<\/name>/) || [])[1]?.trim();
  if (!name) continue;
  // outer-ring coordinate blocks (handles MultiGeometry: multiple outerBoundaryIs)
  const rings = [...body.matchAll(/<outerBoundaryIs>[\s\S]*?<coordinates>([\s\S]*?)<\/coordinates>[\s\S]*?<\/outerBoundaryIs>/g)];
  if (!rings.length) continue;
  let d = '';
  let sx = 0, sy = 0, n = 0;
  for (const r of rings) {
    let pts = r[1].trim().split(/\s+/).map((c) => { const [lng, lat] = c.split(',').map(Number); return proj(lng, lat); }).filter((p) => Number.isFinite(p[0]) && Number.isFinite(p[1]));
    if (pts.length < 4) continue;
    pts = simplify(pts, 1.0).map((p) => [Math.round(p[0]), Math.round(p[1])]);
    if (pts.length < 4) continue;
    d += `M${pts[0][0]} ${pts[0][1]}`;
    for (let i = 1; i < pts.length; i++) d += `L${pts[i][0]} ${pts[i][1]}`;
    d += 'Z';
    for (const p of pts) { sx += p[0]; sy += p[1]; n++; }
  }
  if (!d) continue;
  parishes.push({ name, d, cx: Math.round(sx / n), cy: Math.round(sy / n) });
}

const out = `// AUTO-GENERATED from "Parishes.kmz". Projected with the same box as toXY.
export const PARISHES_VIEWBOX = ${S};
export const PARISHES: { name: string; d: string; cx: number; cy: number }[] = ${JSON.stringify(parishes)};
`;
fs.writeFileSync(OUT, out);
console.log(`parishes=${parishes.length}`);
console.log(parishes.map((p) => `  ${p.name} (${p.d.length} chars, centroid ${p.cx},${p.cy})`).join('\n'));
console.log(`output ${OUT} = ${(Buffer.byteLength(out) / 1024).toFixed(1)} KB`);
