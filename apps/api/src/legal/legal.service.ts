import { BadRequestException, Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LegalDocument, LegalSection, LegalType } from '../database/entities';
import { LEGAL_DEFAULTS } from './defaults';

const TYPES: LegalType[] = ['terms', 'privacy', 'requirements'];

@Injectable()
export class LegalService implements OnModuleInit {
  constructor(@InjectRepository(LegalDocument) private docs: Repository<LegalDocument>) {}

  /** Seed version 1 from the built-in defaults for any type with no rows yet. */
  async onModuleInit() {
    for (const type of TYPES) {
      const count = await this.docs.count({ where: { type } });
      if (count === 0) {
        await this.docs.save(this.docs.create({ type, version: 1, sections: LEGAL_DEFAULTS[type], current: true, publishedBy: 'system' }));
      }
    }
  }

  private dto(d: LegalDocument) {
    return { type: d.type, version: d.version, sections: d.sections, current: d.current, publishedBy: d.publishedBy ?? null, publishedAt: d.publishedAt };
  }

  /** Current published version of a type (public). */
  async getCurrent(type: LegalType) {
    if (!TYPES.includes(type)) throw new BadRequestException('Unknown document type');
    const d = await this.docs.findOne({ where: { type, current: true } });
    if (!d) throw new NotFoundException('Document not found');
    return this.dto(d);
  }

  /** Current version of every type (admin overview). */
  async list() {
    const rows = await this.docs.find({ where: { current: true } });
    return TYPES.map((type) => {
      const d = rows.find((r) => r.type === type);
      return d ? this.dto(d) : { type, version: 0, sections: [], current: true, publishedBy: null, publishedAt: null };
    });
  }

  /** Full version history of a type, newest first (admin). */
  async versions(type: LegalType) {
    if (!TYPES.includes(type)) throw new BadRequestException('Unknown document type');
    const rows = await this.docs.find({ where: { type }, order: { version: 'DESC' } });
    return rows.map((d) => this.dto(d));
  }

  async getVersion(type: LegalType, version: number) {
    const d = await this.docs.findOne({ where: { type, version } });
    if (!d) throw new NotFoundException('Version not found');
    return this.dto(d);
  }

  /** Publish a new version (admin); appends and marks it current. */
  async publish(type: LegalType, sections: LegalSection[], publishedBy?: string) {
    if (!TYPES.includes(type)) throw new BadRequestException('Unknown document type');
    if (!Array.isArray(sections) || !sections.length) throw new BadRequestException('At least one section is required');
    const clean = sections.map((s) => ({
      titleEn: String(s.titleEn ?? '').trim(),
      titleEs: String(s.titleEs ?? '').trim(),
      bodyEn: String(s.bodyEn ?? '').trim(),
      bodyEs: String(s.bodyEs ?? '').trim(),
    }));
    const max = await this.docs.findOne({ where: { type }, order: { version: 'DESC' } });
    const nextVersion = (max?.version ?? 0) + 1;
    await this.docs.update({ type, current: true }, { current: false });
    const saved = await this.docs.save(this.docs.create({ type, version: nextVersion, sections: clean, current: true, publishedBy }));
    return this.dto(saved);
  }
}
