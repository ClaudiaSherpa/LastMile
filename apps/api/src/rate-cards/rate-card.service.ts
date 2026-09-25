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
  bonus: number;
  metMinimum: boolean;
  lowVolume: boolean;
  packages: number;
  weightKg: number;
  distanceKm: number;
  currency: string;
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
    return this.cards.save(this.cards.create({
      name: input.name?.trim() || 'Rate card',
      currency: (input.currency || 'BBD').trim().toUpperCase().slice(0, 6),
      ...this.clean(input),
    }));
  }

  async update(id: string, input: Partial<RateCard>) {
    const c = await this.cards.findOne({ where: { id } });
    if (!c) throw new NotFoundException('Rate card not found');
    if (input.isDefault) await this.cards.update({ isDefault: true }, { isDefault: false });
    Object.assign(c, this.clean(input));
    if (input.name != null) c.name = input.name.trim();
    if (input.currency != null) c.currency = input.currency.trim().toUpperCase().slice(0, 6) || 'BBD';
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
    for (const k of ['active', 'isDefault', 'validFrom', 'validTo', 'minPackages', 'fixedRate', 'ratePerPackage', 'ratePerKg', 'ratePerKm', 'avgWeightKg', 'avgDistanceKm', 'lowVolumeThreshold', 'lowVolumeRatePerPackage', 'bonusThreshold', 'bonusAmount'] as const) {
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
    const weightKg = round(packages * card.avgWeightKg);
    const distanceKm = card.avgDistanceKm;
    const base = {
      packages, weightKg, distanceKm,
      currency: card.currency || 'BBD',
      rateCard: { id: card.id, name: card.name },
    };

    const bonus = card.bonusThreshold > 0 && packages >= card.bonusThreshold ? round(card.bonusAmount) : 0;

    // low-volume routes: flat fixed rate per package (no day rate / kg / km)
    if (card.lowVolumeThreshold > 0 && packages < card.lowVolumeThreshold) {
      const perPackage = round(packages * card.lowVolumeRatePerPackage);
      return { ...base, total: round(perPackage + bonus), fixed: 0, perPackage, perWeight: 0, perKm: 0, bonus, metMinimum: false, lowVolume: true };
    }

    const metMinimum = packages >= (card.minPackages || 0);
    const fixed = round(metMinimum ? card.fixedRate : card.fixedRate / 2);
    const perPackage = round(packages * card.ratePerPackage);
    const perWeight = round(weightKg * card.ratePerKg);
    const perKm = round(distanceKm * card.ratePerKm);
    return { ...base, total: round(fixed + perPackage + perWeight + perKm + bonus), fixed, perPackage, perWeight, perKm, bonus, metMinimum, lowVolume: false };
  }
}
