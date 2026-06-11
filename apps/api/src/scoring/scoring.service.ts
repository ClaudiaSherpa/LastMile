import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { DeliveryStatus, DriverTier, WS_EVENTS } from '@sherpa/shared';
import {
  Delivery,
  DriverProfile,
  Rating,
  ScoringConfig,
} from '../database/entities';
import { AuditService } from '../audit/audit.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { computeScore, recencyScore, tierForScore } from './score';

@Injectable()
export class ScoringService {
  private readonly logger = new Logger('Scoring');

  constructor(
    @InjectRepository(DriverProfile) private drivers: Repository<DriverProfile>,
    @InjectRepository(Rating) private ratings: Repository<Rating>,
    @InjectRepository(Delivery) private deliveries: Repository<Delivery>,
    @InjectRepository(ScoringConfig) private configs: Repository<ScoringConfig>,
    private audit: AuditService,
    private realtime: RealtimeGateway,
  ) {}

  async activeConfig(): Promise<ScoringConfig> {
    let cfg = await this.configs.findOne({ where: { active: true } });
    if (!cfg) {
      cfg = this.configs.create({
        name: 'default',
        active: true,
        weights: { rating: 0.35, completion: 0.2, acceptance: 0.15, onTime: 0.2, recency: 0.1 },
        tiers: [
          { tier: DriverTier.ELITE, min: 92 },
          { tier: DriverTier.PREFERENTE, min: 80 },
          { tier: DriverTier.ESTANDAR, min: 60 },
          { tier: DriverTier.NUEVO, min: 0 },
        ],
      });
      await this.configs.save(cfg);
    }
    return cfg;
  }

  /** Recompute one driver's score + tier from current ratings & deliveries. */
  async recomputeDriver(driverId: string) {
    const driver = await this.drivers.findOne({ where: { id: driverId } });
    if (!driver) return null;
    const cfg = await this.activeConfig();

    const ratings = await this.ratings.find({ where: { driver: { id: driverId } } });
    const avgRating = ratings.length
      ? ratings.reduce((s, r) => s + r.stars, 0) / ratings.length
      : driver.avgRating;

    const finished = await this.deliveries.find({
      where: { driver: { id: driverId }, status: In([DeliveryStatus.DELIVERED, DeliveryStatus.FAILED]) },
    });
    const delivered = finished.filter((d) => d.status === DeliveryStatus.DELIVERED);
    const completionRate = finished.length ? (delivered.length / finished.length) * 100 : driver.completionRate;
    const lastDeliveredAt = delivered
      .map((d) => d.completedAt)
      .filter(Boolean)
      .sort((a, b) => (b as Date).getTime() - (a as Date).getTime())[0] as Date | undefined;

    const score = computeScore(
      {
        avgRating,
        completionRate,
        acceptanceRate: driver.acceptanceRate,
        onTimeRate: driver.onTimeRate,
        recencyScore: recencyScore(lastDeliveredAt ?? null),
      },
      cfg.weights,
    );
    const tier = tierForScore(score, cfg.tiers);

    const before = { score: driver.score, tier: driver.tier };
    driver.score = score;
    driver.tier = tier;
    driver.avgRating = Math.round(avgRating * 100) / 100;
    driver.completionRate = Math.round(completionRate * 10) / 10;
    driver.deliveriesCount = delivered.length || driver.deliveriesCount;
    await this.drivers.save(driver);

    if (before.tier !== tier || before.score !== score) {
      await this.audit.log({
        action: 'score.recomputed',
        entity: 'DriverProfile',
        entityId: driver.id,
        before,
        after: { score, tier },
      });
    }
    this.realtime.emitOps('driver.score', { driverId: driver.id, score, tier });
    return { score, tier };
  }

  /** Nightly recompute across all drivers. */
  async recomputeAll() {
    const drivers = await this.drivers.find();
    for (const d of drivers) await this.recomputeDriver(d.id);
    this.logger.log(`recomputed ${drivers.length} driver scores`);
    return { recomputed: drivers.length };
  }

  async updateConfig(weights?: Partial<ScoringConfig['weights']>, tiers?: ScoringConfig['tiers']) {
    const cfg = await this.activeConfig();
    if (weights) cfg.weights = { ...cfg.weights, ...weights };
    if (tiers) cfg.tiers = tiers;
    await this.configs.save(cfg);
    await this.recomputeAll();
    return cfg;
  }
}
