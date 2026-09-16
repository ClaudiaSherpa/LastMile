// Barbados parish geography. Centers are real lon/lat; polygons are simple boxes
// around each center — enough for ST_Contains eligibility demos.
export interface ZoneSeed {
  slug: string;
  nameEs: string;
  nameEn: string;
  lng: number;
  lat: number;
}

export const ZONES: ZoneSeed[] = [
  { slug: 'st_michael', nameEs: 'Saint Michael', nameEn: 'Saint Michael', lng: -59.616, lat: 13.106 },
  { slug: 'christ_church', nameEs: 'Christ Church', nameEn: 'Christ Church', lng: -59.532, lat: 13.069 },
  { slug: 'st_george', nameEs: 'Saint George', nameEn: 'Saint George', lng: -59.548, lat: 13.135 },
  { slug: 'st_philip', nameEs: 'Saint Philip', nameEn: 'Saint Philip', lng: -59.451, lat: 13.145 },
  { slug: 'st_james', nameEs: 'Saint James', nameEn: 'Saint James', lng: -59.635, lat: 13.187 },
  { slug: 'st_thomas', nameEs: 'Saint Thomas', nameEn: 'Saint Thomas', lng: -59.573, lat: 13.178 },
  { slug: 'st_john', nameEs: 'Saint John', nameEn: 'Saint John', lng: -59.478, lat: 13.178 },
  { slug: 'st_peter', nameEs: 'Saint Peter', nameEn: 'Saint Peter', lng: -59.643, lat: 13.246 },
  { slug: 'st_lucy', nameEs: 'Saint Lucy', nameEn: 'Saint Lucy', lng: -59.610, lat: 13.303 },
  { slug: 'st_andrew', nameEs: 'Saint Andrew', nameEn: 'Saint Andrew', lng: -59.567, lat: 13.230 },
  { slug: 'st_joseph', nameEs: 'Saint Joseph', nameEn: 'Saint Joseph', lng: -59.522, lat: 13.204 },
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
