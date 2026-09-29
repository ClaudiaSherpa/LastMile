import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

/**
 * A single shape on a map layer. Geometry is stored as raw [lng, lat] pairs and
 * projected to the schematic Barbados map on the client.
 * - `rings`  — filled polygons (each ring is a closed outline; holes allowed).
 * - `lines`  — polylines.
 * - `points` — individual markers.
 */
export interface MapFeature {
  name?: string;
  color?: string; // per-feature colour, e.g. "#f23c3c" (from the KML style)
  rings?: number[][][]; // [ring][point][lng,lat]
  lines?: number[][][];
  points?: number[][];
  props?: Record<string, string>;
}

/**
 * An admin-managed map overlay (e.g. Sub-Zones), imported from a KML/KMZ file.
 * Layers are shared across all ops staff and shown as toggles on the live map.
 */
@Entity('map_layers')
export class MapLayer {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column()
  slug: string;

  @Column()
  name: string;

  @Column({ type: 'jsonb' })
  features: MapFeature[];

  @Column({ default: '#2563eb' })
  color: string; // default layer colour (used when a feature has none)

  @Column({ default: true })
  visible: boolean; // whether the toggle starts on

  @Column({ type: 'int', default: 0 })
  sortOrder: number;

  @Column({ nullable: true })
  createdBy?: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
