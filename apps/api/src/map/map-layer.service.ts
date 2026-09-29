import { BadRequestException, Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MapFeature, MapLayer } from '../database/entities';
import { SUB_ZONES_FEATURES } from './sub-zones.default';

const slugify = (s: string) =>
  (s || 'layer').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'layer';

@Injectable()
export class MapLayerService implements OnModuleInit {
  constructor(@InjectRepository(MapLayer) private layers: Repository<MapLayer>) {}

  /** Seed the Sub-Zones layer (from Sub-Zones.kmz) on first boot. */
  async onModuleInit() {
    const existing = await this.layers.findOne({ where: { slug: 'sub-zones' } });
    if (!existing) {
      await this.layers.save(this.layers.create({
        slug: 'sub-zones', name: 'Sub-Zones', color: '#2563eb', visible: true,
        sortOrder: 0, features: SUB_ZONES_FEATURES, createdBy: 'system',
      }));
    }
  }

  private dto(l: MapLayer) {
    return {
      id: l.id, slug: l.slug, name: l.name, color: l.color, visible: l.visible,
      sortOrder: l.sortOrder, featureCount: l.features?.length ?? 0,
      features: l.features, createdBy: l.createdBy ?? null, createdAt: l.createdAt, updatedAt: l.updatedAt,
    };
  }

  async list() {
    const rows = await this.layers.find({ order: { sortOrder: 'ASC', createdAt: 'ASC' } });
    return rows.map((l) => this.dto(l));
  }

  private sanitize(features: any[]): MapFeature[] {
    if (!Array.isArray(features)) throw new BadRequestException('features must be an array');
    const num = (v: any) => (typeof v === 'number' && isFinite(v) ? v : null);
    const ringOf = (r: any): number[][] | null => {
      if (!Array.isArray(r)) return null;
      const pts = r.map((p: any) => (Array.isArray(p) ? [num(p[0]), num(p[1])] : null))
        .filter((p: any) => p && p[0] != null && p[1] != null) as number[][];
      return pts.length >= 2 ? pts : null;
    };
    const clean = features.map((f) => {
      const out: MapFeature = {};
      if (typeof f?.name === 'string') out.name = f.name.slice(0, 200);
      if (typeof f?.color === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(f.color)) out.color = f.color;
      const rings = Array.isArray(f?.rings) ? f.rings.map(ringOf).filter(Boolean) as number[][][] : [];
      const lines = Array.isArray(f?.lines) ? f.lines.map(ringOf).filter(Boolean) as number[][][] : [];
      const points = Array.isArray(f?.points)
        ? (f.points.map((p: any) => (Array.isArray(p) ? [num(p[0]), num(p[1])] : null)).filter((p: any) => p && p[0] != null && p[1] != null) as number[][])
        : [];
      if (rings.length) out.rings = rings;
      if (lines.length) out.lines = lines;
      if (points.length) out.points = points;
      if (f?.props && typeof f.props === 'object') {
        const props: Record<string, string> = {};
        for (const [k, v] of Object.entries(f.props)) if (v != null) props[String(k).slice(0, 60)] = String(v).slice(0, 300);
        if (Object.keys(props).length) out.props = props;
      }
      return out;
    }).filter((f) => f.rings || f.lines || f.points);
    if (!clean.length) throw new BadRequestException('No valid shapes found in the file');
    return clean;
  }

  async create(body: { name?: string; color?: string; features: any[]; visible?: boolean }, createdBy?: string) {
    const features = this.sanitize(body?.features);
    const name = (body?.name || 'Imported layer').trim().slice(0, 80);
    // unique slug
    const base = slugify(name);
    let slug = base;
    for (let i = 2; await this.layers.findOne({ where: { slug } }); i++) slug = `${base}-${i}`;
    const max = await this.layers.find({ order: { sortOrder: 'DESC' }, take: 1 });
    const color = /^#[0-9a-fA-F]{3,8}$/.test(body?.color || '') ? body!.color! : '#2563eb';
    const saved = await this.layers.save(this.layers.create({
      slug, name, color, features, visible: body?.visible ?? true,
      sortOrder: (max[0]?.sortOrder ?? -1) + 1, createdBy,
    }));
    return this.dto(saved);
  }

  async update(id: string, body: { name?: string; color?: string; visible?: boolean }) {
    const l = await this.layers.findOne({ where: { id } });
    if (!l) throw new NotFoundException('Layer not found');
    if (typeof body?.name === 'string' && body.name.trim()) l.name = body.name.trim().slice(0, 80);
    if (typeof body?.color === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(body.color)) l.color = body.color;
    if (typeof body?.visible === 'boolean') l.visible = body.visible;
    return this.dto(await this.layers.save(l));
  }

  async remove(id: string) {
    const l = await this.layers.findOne({ where: { id } });
    if (!l) throw new NotFoundException('Layer not found');
    await this.layers.remove(l);
    return { ok: true };
  }
}
