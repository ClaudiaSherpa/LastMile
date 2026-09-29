// Parse a KML or KMZ file (client-side) into the normalized MapFeature[] shape
// the map_layers store expects. KMZ is unzipped with JSZip; KML is parsed with
// the browser's DOMParser. Dense rings are Douglas–Peucker simplified so the
// stored/streamed geometry stays light for the schematic overview map.
import JSZip from 'jszip';

export interface MapFeature {
  name?: string;
  color?: string;
  rings?: number[][][];
  lines?: number[][][];
  points?: number[][];
  props?: Record<string, string>;
}
export interface ParsedLayer { name: string; features: MapFeature[] }

const round = (n: number) => Math.round(n * 1e6) / 1e6;

// KML colour is aabbggrr -> #rrggbb
function kmlColor(c?: string | null): string | undefined {
  if (!c) return undefined;
  const h = c.trim().replace(/^#/, '');
  if (h.length !== 8) return undefined;
  return ('#' + h.slice(6, 8) + h.slice(4, 6) + h.slice(2, 4)).toLowerCase();
}

function perpDist(p: number[], a: number[], b: number[]) {
  const [x, y] = p, [x1, y1] = a, [x2, y2] = b;
  const dx = x2 - x1, dy = y2 - y1;
  if (dx === 0 && dy === 0) return Math.hypot(x - x1, y - y1);
  const t = ((x - x1) * dx + (y - y1) * dy) / (dx * dx + dy * dy);
  return Math.hypot(x - (x1 + t * dx), y - (y1 + t * dy));
}
function dp(pts: number[][], eps: number): number[][] {
  if (pts.length < 3) return pts;
  let idx = 0, max = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    const d = perpDist(pts[i], pts[0], pts[pts.length - 1]);
    if (d > max) { max = d; idx = i; }
  }
  if (max > eps) return dp(pts.slice(0, idx + 1), eps).slice(0, -1).concat(dp(pts.slice(idx), eps));
  return [pts[0], pts[pts.length - 1]];
}

function parseCoords(text: string | null | undefined, simplify: boolean): number[][] {
  if (!text) return [];
  let ring = text.trim().split(/\s+/).map((pt) => {
    const [lng, lat] = pt.split(',').map(Number);
    return [lng, lat];
  }).filter((p) => isFinite(p[0]) && isFinite(p[1]));
  if (simplify && ring.length >= 4) ring = dp(ring, 0.00025);
  return ring.map(([lng, lat]) => [round(lng), round(lat)]);
}

const els = (parent: Element | Document, tag: string) => Array.from(parent.getElementsByTagName(tag));
const firstText = (parent: Element, tag: string) => els(parent, tag)[0]?.textContent?.trim() || undefined;

function buildStyleMap(doc: Document): Record<string, string> {
  const map: Record<string, string> = {};
  for (const s of els(doc, 'Style')) {
    const id = s.getAttribute('id');
    if (!id) continue;
    const poly = els(s, 'PolyStyle')[0];
    const line = els(s, 'LineStyle')[0];
    const c = kmlColor(poly && firstText(poly, 'color')) || kmlColor(line && firstText(line, 'color'));
    if (c) map['#' + id] = c;
  }
  for (const sm of els(doc, 'StyleMap')) {
    const id = sm.getAttribute('id');
    if (!id) continue;
    for (const pair of els(sm, 'Pair')) {
      if (firstText(pair, 'key') === 'normal') {
        const url = firstText(pair, 'styleUrl');
        if (url && map[url]) map['#' + id] = map[url];
      }
    }
  }
  return map;
}

function layerName(doc: Document, fileName: string): string {
  const folder = els(doc, 'Folder')[0];
  const fromFolder = folder && firstText(folder, 'name');
  const docEl = els(doc, 'Document')[0];
  const fromDoc = docEl && firstText(docEl, 'name');
  const raw = fromFolder || fromDoc || fileName.replace(/\.(kml|kmz)$/i, '');
  return raw.replace(/\.(kml|kmz)$/i, '').trim().slice(0, 80) || 'Imported layer';
}

function parseKmlText(text: string, fileName: string): ParsedLayer {
  const doc = new DOMParser().parseFromString(text, 'application/xml');
  if (els(doc, 'parsererror').length) throw new Error('The file is not valid KML.');
  const styles = buildStyleMap(doc);
  const features: MapFeature[] = [];

  for (const pm of els(doc, 'Placemark')) {
    const f: MapFeature = {};
    const nm = firstText(pm, 'name');
    if (nm) f.name = nm.slice(0, 200);
    const styleUrl = firstText(pm, 'styleUrl');
    const color = (styleUrl && styles[styleUrl.startsWith('#') ? styleUrl : '#' + styleUrl]) || undefined;
    if (color) f.color = color;

    const props: Record<string, string> = {};
    for (const d of els(pm, 'Data')) {
      const k = d.getAttribute('name');
      const v = firstText(d, 'value');
      if (k && v) props[k.slice(0, 60)] = v.slice(0, 300);
    }
    if (Object.keys(props).length) f.props = props;

    const rings: number[][][] = [];
    for (const poly of els(pm, 'Polygon')) {
      for (const co of els(poly, 'coordinates')) {
        const ring = parseCoords(co.textContent, true);
        if (ring.length >= 3) rings.push(ring);
      }
    }
    const lines: number[][][] = [];
    for (const ls of els(pm, 'LineString')) {
      const line = parseCoords(firstText(ls, 'coordinates'), true);
      if (line.length >= 2) lines.push(line);
    }
    const points: number[][] = [];
    for (const pt of els(pm, 'Point')) {
      const p = parseCoords(firstText(pt, 'coordinates'), false)[0];
      if (p) points.push(p);
    }
    if (rings.length) f.rings = rings;
    if (lines.length) f.lines = lines;
    if (points.length) f.points = points;
    if (f.rings || f.lines || f.points) features.push(f);
  }

  if (!features.length) throw new Error('No shapes (polygons, lines or points) found in the file.');
  return { name: layerName(doc, fileName), features };
}

export async function parseKmlOrKmz(file: File): Promise<ParsedLayer> {
  const isKmz = /\.kmz$/i.test(file.name);
  if (isKmz) {
    const zip = await JSZip.loadAsync(await file.arrayBuffer());
    const entry = Object.values(zip.files).find((f) => /\.kml$/i.test(f.name) && !f.dir)
      || zip.files['doc.kml'];
    if (!entry) throw new Error('No .kml found inside the KMZ archive.');
    return parseKmlText(await entry.async('string'), file.name);
  }
  return parseKmlText(await file.text(), file.name);
}
