import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import {
  DeliveryStatus,
  DriverStatus,
  FreightStatus,
  NotificationChannel,
  TenderResponseType,
  VehicleType,
  WS_EVENTS,
} from '@sherpa/shared';
import {
  Delivery,
  DriverProfile,
  Freight,
  Tender,
  TenderResponse,
} from '../database/entities';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  CandidateDriver,
  driversForWave,
  MAX_WAVE,
  rankEligibleDrivers,
} from './pool';
import { env } from '../config/env';

type Ranked = { id: string; wave: number; score: number; tier: string };

@Injectable()
export class TenderService {
  private readonly logger = new Logger('Tender');
  private timers = new Map<string, NodeJS.Timeout>();

  constructor(
    @InjectRepository(Freight) private freights: Repository<Freight>,
    @InjectRepository(Tender) private tenders: Repository<Tender>,
    @InjectRepository(TenderResponse) private responses: Repository<TenderResponse>,
    @InjectRepository(Delivery) private deliveries: Repository<Delivery>,
    @InjectRepository(DriverProfile) private drivers: Repository<DriverProfile>,
    private realtime: RealtimeGateway,
    private audit: AuditService,
    private notify: NotificationsService,
  ) {}

  private async candidates(): Promise<CandidateDriver[]> {
    const list = await this.drivers.find({ relations: { vehicles: true, operatingAreas: true } });
    return list.map((d) => ({
      id: d.id,
      securityCleared: d.securityCleared,
      eligible: d.eligible,
      onDuty: d.onDuty,
      status: d.status,
      tier: d.tier,
      score: d.score,
      onTimeRate: d.onTimeRate,
      vehicleType: d.vehicles?.[0]?.type as VehicleType | undefined,
      capacityKg: d.vehicles?.[0]?.capacityKg ?? undefined,
      zones: d.operatingAreas?.map((a) => a.slug) ?? [],
    }));
  }

  /** Compute the eligible pool, open a tender, and broadcast wave 0. */
  async broadcast(freightId: string) {
    const freight = await this.freights.findOne({ where: { id: freightId } });
    if (!freight) throw new NotFoundException('Freight not found');
    if (freight.status === FreightStatus.ASSIGNED || freight.status === FreightStatus.COMPLETED) {
      throw new BadRequestException(`Freight is ${freight.status}`);
    }

    const ranked: Ranked[] = rankEligibleDrivers(
      {
        requiredVehicle: freight.requiredVehicle,
        weightKg: freight.weightKg,
        pickupZone: freight.pickupZone,
        dropZone: freight.dropZone,
        priority: freight.priority,
      },
      await this.candidates(),
    );

    const tender = await this.tenders.save(
      this.tenders.create({ freight, currentWave: 0, rankedDriverIds: ranked as any, open: true }),
    );
    freight.status = FreightStatus.BROADCASTING;
    await this.freights.save(freight);

    await this.audit.log({
      action: 'tender.broadcast',
      entity: 'Freight',
      entityId: freight.id,
      after: { tenderId: tender.id, poolSize: ranked.length },
    });

    this.offerWave(tender.id, freight, ranked, 0);
    this.scheduleAdvance(tender.id);

    return {
      tenderId: tender.id,
      reference: freight.reference,
      poolSize: ranked.length,
      wave0: driversForWave(ranked, 0).length,
      ranked,
    };
  }

  private offerWave(tenderId: string, freight: Freight, ranked: Ranked[], wave: number) {
    const offered = driversForWave(ranked, wave);
    const payload = {
      tenderId,
      wave,
      freight: {
        id: freight.id,
        reference: freight.reference,
        client: freight.client,
        pickupZone: freight.pickupZone,
        dropZone: freight.dropZone,
        requiredVehicle: freight.requiredVehicle,
        weightKg: freight.weightKg,
        payout: freight.payout,
        distanceKm: freight.distanceKm,
        windowMinutes: freight.windowMinutes,
        priority: freight.priority,
      },
    };
    for (const driverId of offered) {
      this.realtime.emitDriver(driverId, WS_EVENTS.TENDER_OFFER, payload);
      this.notify
        .send({
          templateKey: 'tender.offer',
          channel: NotificationChannel.PUSH,
          recipientUserId: undefined,
          vars: { ref: freight.reference, payout: `$${freight.payout.toLocaleString('es-CO')}` },
        })
        .catch(() => {});
    }
    this.realtime.emitOps(WS_EVENTS.TENDER_OFFER, { ...payload, offeredCount: offered.length });
    this.logger.log(`tender ${tenderId} wave ${wave} → ${offered.length} drivers`);
  }

  private scheduleAdvance(tenderId: string) {
    const t = setTimeout(() => this.advanceWave(tenderId).catch(() => {}), env.tenders.waveMs);
    this.timers.set(tenderId, t);
  }
  private clearTimer(tenderId: string) {
    const t = this.timers.get(tenderId);
    if (t) clearTimeout(t);
    this.timers.delete(tenderId);
  }

  /** Widen the offer to the next wave, or expire + re-broadcast if exhausted. */
  async advanceWave(tenderId: string) {
    const tender = await this.tenders.findOne({ where: { id: tenderId }, relations: { freight: true } });
    if (!tender || !tender.open) return;
    const ranked = (tender.rankedDriverIds as unknown as Ranked[]) ?? [];
    if (tender.currentWave >= MAX_WAVE) {
      // exhausted — release back to the pool for a fresh broadcast
      tender.open = false;
      await this.tenders.save(tender);
      tender.freight.status = FreightStatus.AVAILABLE;
      await this.freights.save(tender.freight);
      this.realtime.emitOps(WS_EVENTS.TENDER_RESOLVED, { tenderId, outcome: 'expired', freightId: tender.freight.id });
      await this.audit.log({ action: 'tender.expired', entity: 'Freight', entityId: tender.freight.id, after: { tenderId } });
      this.clearTimer(tenderId);
      return;
    }
    tender.currentWave += 1;
    await this.tenders.save(tender);
    this.offerWave(tenderId, tender.freight, ranked, tender.currentWave);
    this.scheduleAdvance(tenderId);
  }

  /** First valid accept wins — assigns the freight and opens a delivery. */
  async accept(tenderId: string, driverId: string) {
    const tender = await this.tenders.findOne({ where: { id: tenderId }, relations: { freight: true } });
    if (!tender) throw new NotFoundException('Tender not found');
    const ranked = (tender.rankedDriverIds as unknown as Ranked[]) ?? [];
    const entry = ranked.find((r) => r.id === driverId);
    if (!entry) throw new BadRequestException('Driver not in eligible pool');
    if (entry.wave > tender.currentWave) throw new BadRequestException('Not yet offered in your wave');

    // atomic first-accept-wins
    const won = await this.tenders.update({ id: tenderId, open: true }, { open: false });
    if (!won.affected) throw new ConflictException('Tender already taken');
    this.clearTimer(tenderId);

    const driver = await this.drivers.findOne({ where: { id: driverId } });
    if (!driver) throw new NotFoundException('Driver not found');

    const freight = tender.freight;
    freight.status = FreightStatus.ASSIGNED;
    freight.assignedDriver = driver;
    await this.freights.save(freight);

    driver.status = DriverStatus.ENROUTE;
    await this.drivers.save(driver);

    const now = new Date().toISOString();
    const delivery = await this.deliveries.save(
      this.deliveries.create({
        freight,
        driver,
        status: DeliveryStatus.ASSIGNED,
        timeline: { assigned: now },
        trackingToken: crypto.randomBytes(12).toString('hex'),
      }),
    );

    await this.responses.save(
      this.responses.create({ tender, driver, wave: tender.currentWave, response: TenderResponseType.ACCEPT }),
    );
    await this.audit.log({
      action: 'tender.accepted',
      entity: 'Delivery',
      entityId: delivery.id,
      after: { driverId, freight: freight.reference },
    });

    const resolved = { tenderId, outcome: 'assigned', driverId, deliveryId: delivery.id, freightId: freight.id };
    this.realtime.emitOps(WS_EVENTS.TENDER_RESOLVED, resolved);
    for (const r of ranked) this.realtime.emitDriver(r.id, WS_EVENTS.TENDER_RESOLVED, resolved);

    return {
      deliveryId: delivery.id,
      trackingToken: delivery.trackingToken,
      freight: { id: freight.id, reference: freight.reference },
      status: delivery.status,
    };
  }

  async decline(tenderId: string, driverId: string) {
    const tender = await this.tenders.findOne({ where: { id: tenderId } });
    if (!tender) throw new NotFoundException('Tender not found');
    const driver = await this.drivers.findOne({ where: { id: driverId } });
    if (!driver) throw new NotFoundException('Driver not found');
    await this.responses.save(
      this.responses.create({ tender, driver, wave: tender.currentWave, response: TenderResponseType.DECLINE }),
    );
    return { ok: true };
  }

  async getTender(tenderId: string) {
    const tender = await this.tenders.findOne({ where: { id: tenderId }, relations: { freight: true, responses: { driver: true } } });
    if (!tender) throw new NotFoundException('Tender not found');
    return {
      id: tender.id,
      open: tender.open,
      currentWave: tender.currentWave,
      freight: { id: tender.freight.id, reference: tender.freight.reference, status: tender.freight.status },
      ranked: tender.rankedDriverIds,
      responses: tender.responses?.map((r) => ({ driverId: r.driver?.id, response: r.response, wave: r.wave })),
    };
  }
}
