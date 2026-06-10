// Approximate Bogotá neighborhood geography. Centers are real lon/lat; polygons
// are simple boxes around each center — enough for ST_Contains eligibility demos.
export interface ZoneSeed {
  slug: string;
  nameEs: string;
  nameEn: string;
  lng: number;
  lat: number;
}

export const ZONES: ZoneSeed[] = [
  { slug: 'usaquen', nameEs: 'Usaquén', nameEn: 'Usaquén', lng: -74.03, lat: 4.694 },
  { slug: 'suba', nameEs: 'Suba', nameEn: 'Suba', lng: -74.085, lat: 4.745 },
  { slug: 'chico', nameEs: 'Chicó', nameEn: 'Chicó', lng: -74.046, lat: 4.68 },
  { slug: 'chapinero', nameEs: 'Chapinero', nameEn: 'Chapinero', lng: -74.063, lat: 4.645 },
  { slug: 'teusaquillo', nameEs: 'Teusaquillo', nameEn: 'Teusaquillo', lng: -74.083, lat: 4.631 },
  { slug: 'engativa', nameEs: 'Engativá', nameEn: 'Engativá', lng: -74.115, lat: 4.69 },
  { slug: 'fontibon', nameEs: 'Fontibón', nameEn: 'Fontibón', lng: -74.146, lat: 4.673 },
  { slug: 'centro', nameEs: 'Centro', nameEn: 'Downtown', lng: -74.075, lat: 4.598 },
  { slug: 'kennedy', nameEs: 'Kennedy', nameEn: 'Kennedy', lng: -74.15, lat: 4.628 },
  { slug: 'bosa', nameEs: 'Bosa', nameEn: 'Bosa', lng: -74.185, lat: 4.605 },
];

export const zoneBySlug = (slug: string) => ZONES.find((z) => z.slug === slug);

/** GeoJSON box polygon (~±0.018°) around a center, ring closed. */
export function boxPolygon(lng: number, lat: number, d = 0.018) {
  return {
    type: 'Polygon',
    coordinates: [
      [
        [lng - d, lat - d],
        [lng + d, lat - d],
        [lng + d, lat + d],
        [lng - d, lat + d],
        [lng - d, lat - d],
      ],
    ],
  };
}

export const point = (lng: number, lat: number) => ({ type: 'Point', coordinates: [lng, lat] });
