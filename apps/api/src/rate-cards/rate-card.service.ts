import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RateCard } from '../database/entities';

export interface PayEstimate {
  total: number;
  fixed: number;
  perPackage: number;
  perWeight: number;
  perKm: number;
  metMinimum: boolean;
  packages: number;
  weightKg: number;
  distanceKm: number;
  rateCard: { id: string; name: string };
}

@Injectable()
export class RateCardService {
  constructor(@InjectRepository(RateCard) private cards: Repository<RateCard>) {}

  private valid(c: RateCard, date: string): boolean {
    if (!c.active) return false;
    if (c.validFrom && date < c.validFrom) return false;
    if (c.validTo && date > c.validTo) return false;
    return true;
  }

  list() {
    return this.cards.find({ order: { isDefault: 'DESC', createdAt: 'DESC' } });
  }

  async create(input: Partial<RateCard>) {
    if (input.isDefault) await this.cards.update({ isDefault: true }, { isDefault: false });
    return this.cards.save(this.cards.create({ name: input.name?.trim() || 'Rate card', ...this.clean(input) }));
  }

  async update(id: string, input: Partial<RateCard>) {
    const c = await this.cards.findOne({ where: { id } });
    if (!c) throw new NotFoundException('Rate card not found');
    if (input.isDefault) await this.cards.update({ isDefault: true }, { isDefault: false });
    Object.assign(c, this.clean(input));
    if (input.name != null) c.name = input.name.trim();
    return this.cards.save(c);
  }

  async remove(id: string) {
    const c = await this.cards.findOne({ where: { id } });
    if (!c) throw new NotFoundException('Rate card not found');
    await this.cards.remove(c);
    return { ok: true };
  }

  // whitelist of numeric/flag fields to copy
  private clean(input: Partial<RateCard>): Partial<RateCard> {
    const out: any = {};
    for (const k of ['active', 'isDefault', 'validFrom', 'validTo', 'minPackages', 'fixedRate', 'ratePerPackage', 'ratePerKg', 'ratePerKm', 'avgWeightKg', 'avgDistanceKm'] as const) {
      if (input[k] !== undefined) out[k] = input[k];
    }
    return out;
  }

  /** All cards (for prefetch + in-memory pick during a broadcast). */
  all() {
    return this.cards.find();
  }

  /** Pure: the card that applies to a driver on a date — their card, else the default. */
  pick(all: RateCard[], rateCardId: string | undefined | null, date: string): RateCard | null {
    if (rateCardId) {
      const assigned = all.find((c) => c.id === rateCardId);
      if (assigned && this.valid(assigned, date)) return assigned;
    }
    return all.find((c) => c.isDefault && this.valid(c, date)) ?? null;
  }

  /** The card that applies to a driver on a date: their assigned card, else the default. */
  async resolveForDriver(rateCardId: string | undefined | null, date: string): Promise<RateCard | null> {
    return this.pick(await this.cards.find(), rateCardId, date);
  }

  /** Estimated pay for a tender of N packages under a card. */
  estimate(card: RateCard | null, packages: number): PayEstimate | null {
    if (!card) return null;
    const round = (n: number) => Math.round(n * 100) / 100;
    const metMinimum = packages >= (card.minPackages || 0);
    const fixed = round(metMinimum ? card.fixedRate : card.fixedRate / 2);
    const perPackage = round(packages * card.ratePerPackage);
    const weightKg = round(packages * card.avgWeightKg);
    const perWeight = round(weightKg * card.ratePerKg);
    const distanceKm = card.avgDistanceKm;
    const perKm = round(distanceKm * card.ratePerKm);
    return {
      total: round(fixed + perPackage + perWeight + perKm),
      fixed, perPackage, perWeight, perKm,
      metMinimum, packages, weightKg, distanceKm,
      rateCard: { id: card.id, name: card.name },
    };
  }
}
