// Convert an OSM roads KMZ/KML into a compact, pre-projected SVG-path module for
// the Ops live map. Usage:
//   unzip "Barbados Roads.kmz" -d /tmp/bbroads   # yields /tmp/bbroads/doc.kml
//   KML=/tmp/bbroads/doc.kml node scripts/kml2roads.mjs
// Writes apps/admin/src/assets/barbados-roads.ts (paths projected with the same
// box as toXY in App.tsx). Re-run whenever the source roads file changes.
import fs from 'node:fs';

const KML = process.env.KML || 'bbroads/doc.kml';
const OUT = process.env.OUT || 'apps/admin/src/assets/barbados-roads.ts';

// must match apps/admin/src/App.tsx toXY / BARBADOS box
const B = { minLng: -59.66, maxLng: -59.42, minLat: 13.04, maxLat: 13.34 };
const S = 2000; // viewBox size (integer coords, ~13m x / ~16m y precision)
const proj = (lng, lat) => [
  ((lng - B.minLng) / (B.maxLng - B.minLng)) * S,
  (1 - (lat - B.minLat) / (B.maxLat - B.minLat)) * S,
];

const CLASS = {
  motorway: 'major', motorway_link: 'major', trunk: 'major', trunk_link: 'major',
  primary: 'major', primary_link: 'major',
  secondary: 'medium', secondary_link: 'medium', tertiary: 'medium', tertiary_link: 'medium',
  residential: 'minor', unclassified: 'minor', living_street: 'minor',
};

// Douglas-Peucker simplify (epsilon in viewBox units)
function simplify(pts, eps) {
  if (pts.length < 3) return pts;
  const sq = (a, b) => { const dx = a[0] - b[0], dy = a[1] - b[1]; return dx * dx + dy * dy; };
  const segDist = (p, a, b) => {
    let x = a[0], y = a[1], dx = b[0] - x, dy = b[1] - y;
    if (dx || dy) {
      const t = ((p[0] - x) * dx + (p[1] - y) * dy) / (dx * dx + dy * dy);
      if (t > 1) { x = b[0]; y = b[1]; } else if (t > 0) { x += dx * t; y += dy * t; }
    }
    return sq(p, [x, y]);
  };
  const e2 = eps * eps;
  const keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [lo, hi] = stack.pop();
    let idx = -1, max = 0;
    for (let i = lo + 1; i < hi; i++) { const d = segDist(pts[i], pts[lo], pts[hi]); if (d > max) { max = d; idx = i; } }
    if (max > e2 && idx > 0) { keep[idx] = 1; stack.push([lo, idx], [idx, hi]); }
  }
  return pts.filter((_, i) => keep[i]);
}

const xml = fs.readFileSync(KML, 'utf8');
const paths = { major: [], medium: [], minor: [] };
let total = 0, kept = 0, points = 0;

// iterate placemarks
const re = /<Placemark>([\s\S]*?)<\/Placemark>/g;
let m;
while ((m = re.exec(xml))) {
  total++;
  const body = m[1];
  const hwMatch = body.match(/<SimpleData name="highway">([^<]*)<\/SimpleData>/);
  const hw = hwMatch ? hwMatch[1].trim() : '';
  const cls = CLASS[hw];
  if (!cls) continue;
  const coordMatch = body.match(/<coordinates>([\s\S]*?)<\/coordinates>/);
  if (!coordMatch) continue;
  let pts = coordMatch[1].trim().split(/\s+/).map((c) => {
    const [lng, lat] = c.split(',').map(Number);
    return proj(lng, lat);
  }).filter((p) => Number.isFinite(p[0]) && Number.isFinite(p[1]));
  if (pts.length < 2) continue;
  pts = simplify(pts, 1.2);
  // round to integers + drop consecutive dupes
  const r = [];
  for (const p of pts) {
    const q = [Math.round(p[0]), Math.round(p[1])];
    if (!r.length || r[r.length - 1][0] !== q[0] || r[r.length - 1][1] !== q[1]) r.push(q);
  }
  if (r.length < 2) continue;
  let d = `M${r[0][0]} ${r[0][1]}`;
  for (let i = 1; i < r.length; i++) d += `L${r[i][0]} ${r[i][1]}`;
  paths[cls].push(d);
  kept++; points += r.length;
}

const out = `// AUTO-GENERATED from "Barbados Roads.kmz" (OSM roads_lines). Do not edit by hand.
// Projected with the same box as toXY in App.tsx; render in <svg viewBox="0 0 ${S} ${S}" preserveAspectRatio="none">.
export const ROADS_VIEWBOX = ${S};
export const ROADS = {
  major: ${JSON.stringify(paths.major.join(''))},
  medium: ${JSON.stringify(paths.medium.join(''))},
  minor: ${JSON.stringify(paths.minor.join(''))},
};
`;
fs.writeFileSync(OUT, out);
const bytes = Buffer.byteLength(out);
console.log(`placemarks=${total} roads_kept=${kept} points=${points}`);
console.log(`major=${paths.major.length} medium=${paths.medium.length} minor=${paths.minor.length}`);
console.log(`output ${OUT} = ${(bytes / 1024).toFixed(0)} KB`);
