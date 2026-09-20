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
  DeliveryPlanStatus,
  DeliveryStatus,
  DEFAULT_PACKAGE_CAPACITY,
  PlanLineStatus,
  PlanTenderStatus,
  VehicleType,
} from '@sherpa/shared';
import {
  Delivery,
  DeliveryPlan,
  DeliveryPlanLine,
  DriverDay,
  DriverProfile,
  PlanTender,
  User,
} from '../database/entities';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { WhatsAppService } from '../whatsapp/whatsapp.service';
import { env } from '../config/env';

export interface PlanLineInput {
  parish: string;
  packages: number;
  preassigned?: string[]; // driver emails or phones
}
export interface CreatePlanInput {
  name?: string;
  hubName?: string;
  operationalDate?: string; // YYYY-MM-DD
  vehicleCapacities?: Partial<Record<VehicleType, number>>;
  lines: PlanLineInput[];
}

@Injectable()
export class DeliveryPlanService {
  private readonly logger = new Logger('DeliveryPlan');

  constructor(
    @InjectRepository(DeliveryPlan) private plans: Repository<DeliveryPlan>,
    @InjectRepository(DeliveryPlanLine) private lines: Repository<DeliveryPlanLine>,
    @InjectRepository(PlanTender) private tenders: Repository<PlanTender>,
    @InjectRepository(DriverProfile) private drivers: Repository<DriverProfile>,
    @InjectRepository(User) private users: Repository<User>,
    @InjectRepository(Delivery) private deliveries: Repository<Delivery>,
    @InjectRepository(DriverDay) private driverDays: Repository<DriverDay>,
    private realtime: RealtimeGateway,
    private whatsapp: WhatsAppService,
  ) {}

  private prettyParish(slug: string): string {
    return slug.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  }

  /** WhatsApp a driver that a tender is available, with a link to open the app. */
  private notifyOffer(phone: string | undefined, parish: string, packages: number, hub: string, date?: string, preassigned = false) {
    if (!phone) return;
    const when = date ? ` (${date})` : '';
    const link = env.api.publicBaseUrl;
    const text = preassigned
      ? `PasarEx: You've been pre-assigned ${packages} packages for ${this.prettyParish(parish)}${when}, pickup at ${hub}. Open the app: ${link}`
      : `PasarEx: New delivery offer${when} — ${packages} packages for ${this.prettyParish(parish)}, pickup at ${hub}. Open the app to accept: ${link}`;
    void this.whatsapp.send(phone, text).catch(() => {});
  }

  /** WhatsApp a driver that a parish tender is now fully covered. */
  private notifyFilled(phone: string | undefined, parish: string, date?: string) {
    if (!phone) return;
    const when = date ? ` (${date})` : '';
    const text = `PasarEx: The ${this.prettyParish(parish)} delivery${when} is now fully covered and no longer available.`;
    void this.whatsapp.send(phone, text).catch(() => {});
  }

  private capacityOf(plan: DeliveryPlan, type?: VehicleType): number {
    if (!type) return 0;
    return plan.vehicleCapacities?.[type] ?? DEFAULT_PACKAGE_CAPACITY[type] ?? 0;
  }

  /** Resolve driver-profile ids from a list of emails/phones. */
  private async resolveDrivers(identifiers: string[]): Promise<string[]> {
    const ids: string[] = [];
    for (const raw of identifiers) {
      const id = (raw ?? '').trim();
      if (!id) continue;
      // a driver-profile id (from the Ops dropdown) — use it directly
      if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
        const byId = await this.drivers.findOne({ where: { id } });
        if (byId) { ids.push(byId.id); continue; }
      }
      // otherwise resolve by email or phone (CSV import)
      const user = await this.users.findOne({
        where: [{ email: id }, { phone: id }],
        relations: { driverProfile: true },
      });
      if (user?.driverProfile) ids.push(user.driverProfile.id);
      else this.logger.warn(`preassigned driver not found: ${id}`);
    }
    return [...new Set(ids)];
  }

  async create(input: CreatePlanInput): Promise<any> {
    if (!input.lines?.length) throw new BadRequestException('Plan has no lines');
    const count = await this.plans.count();
    const capacities = { ...DEFAULT_PACKAGE_CAPACITY, ...(input.vehicleCapacities ?? {}) };

    const plan = await this.plans.save(
      this.plans.create({
        reference: `DP-${1001 + count}`,
        name: input.name,
        hubName: input.hubName || 'PasarEx Hub',
        operationalDate: input.operationalDate || undefined,
        vehicleCapacities: capacities,
        status: DeliveryPlanStatus.DRAFT,
      }),
    );

    for (const l of input.lines) {
      if (!l.parish || !(l.packages > 0)) throw new BadRequestException(`Invalid line: ${JSON.stringify(l)}`);
      const preassignedDriverIds = await this.resolveDrivers(l.preassigned ?? []);
      await this.lines.save(
        this.lines.create({
          plan,
          parish: l.parish,
          requiredPackages: Math.round(l.packages),
          preassignedDriverIds,
          status: PlanLineStatus.PENDING,
        }),
      );
    }
    return this.get(plan.id);
  }

  /** Candidate drivers with the fields eligibility + capacity need. */
  private async candidates(): Promise<
    Array<{ id: string; securityCleared: boolean; eligible: boolean; zones: string[]; vehicle?: VehicleType; weekdays: number[]; phone?: string }>
  > {
    const list = await this.drivers.find({ relations: { vehicles: true, operatingAreas: true, availability: true, user: true } });
    return list.map((d) => ({
      id: d.id,
      securityCleared: d.securityCleared,
      eligible: d.eligible,
      zones: d.operatingAreas?.map((a) => a.slug) ?? [],
      vehicle: d.vehicles?.[0]?.type as VehicleType | undefined,
      weekdays: Array.from(new Set((d.availability ?? []).map((s) => s.weekday))),
      phone: d.user?.phone,
    }));
  }

  private eligibleForParish(
    c: { securityCleared: boolean; eligible: boolean; zones: string[]; weekdays: number[] },
    parish: string,
    weekday?: number | null,
  ) {
    const base = c.securityCleared && c.eligible && c.zones.includes(parish);
    if (weekday == null) return base;
    return base && c.weekdays.includes(weekday); // driver must work that day
  }

  /**
   * Broadcast a plan: order parishes scarcest-first, auto-accept pre-assigned
   * drivers, then tender the remainder to eligible drivers (sized to vehicle).
   */
  async broadcast(planId: string): Promise<any> {
    const plan = await this.plans.findOne({ where: { id: planId }, relations: { lines: true } });
    if (!plan) throw new NotFoundException('Plan not found');
    if (plan.status !== DeliveryPlanStatus.DRAFT) throw new BadRequestException(`Plan is ${plan.status}`);

    const cands = await this.candidates();
    const byId = new Map(cands.map((c) => [c.id, c]));
    // only tender to drivers available on the plan's operational weekday
    const weekday = plan.operationalDate ? new Date(`${plan.operationalDate}T00:00:00Z`).getUTCDay() : null;

    // eligible count per line -> scarcest first
    for (const line of plan.lines) {
      line.eligibleCount = cands.filter((c) => this.eligibleForParish(c, line.parish, weekday)).length;
    }
    const ordered = [...plan.lines].sort((a, b) => a.eligibleCount - b.eligibleCount);

    let order = 0;
    for (const line of ordered) {
      line.broadcastOrder = order++;
      let accepted = 0;

      // 1) pre-assigned drivers auto-accept their vehicle capacity
      for (const drvId of line.preassignedDriverIds ?? []) {
        const c = byId.get(drvId);
        const cap = this.capacityOf(plan, c?.vehicle);
        if (!c || cap <= 0) { this.logger.warn(`preassigned ${drvId} has no usable vehicle`); continue; }
        await this.tenders.save(
          this.tenders.create({ line, driver: { id: drvId } as DriverProfile, packages: cap, preassigned: true, status: PlanTenderStatus.AUTO_ACCEPTED, respondedAt: new Date() }),
        );
        accepted += cap;
        this.realtime.emitDriver(drvId, 'plan.tender', { lineId: line.id, parish: line.parish, packages: cap, hub: plan.hubName, preassigned: true, autoAccepted: true });
        this.notifyOffer(c?.phone, line.parish, cap, plan.hubName, plan.operationalDate, true);
      }

      // 2) tender the remainder to eligible (non-preassigned) drivers
      if (accepted < line.requiredPackages) {
        const pre = new Set(line.preassignedDriverIds ?? []);
        const eligible = cands.filter((c) => this.eligibleForParish(c, line.parish, weekday) && !pre.has(c.id));
        for (const c of eligible) {
          const cap = this.capacityOf(plan, c.vehicle);
          if (cap <= 0) continue;
          await this.tenders.save(
            this.tenders.create({ line, driver: { id: c.id } as DriverProfile, packages: cap, preassigned: false, status: PlanTenderStatus.OFFERED }),
          );
          this.realtime.emitDriver(c.id, 'plan.tender', { lineId: line.id, parish: line.parish, packages: cap, hub: plan.hubName });
          this.notifyOffer(c.phone, line.parish, cap, plan.hubName, plan.operationalDate);
        }
        // no one can cover the remainder -> the line is unfeasible
        line.status = eligible.length ? PlanLineStatus.BROADCASTING : PlanLineStatus.UNFEASIBLE;
      } else {
        line.status = PlanLineStatus.FILLED;
      }

      line.acceptedPackages = accepted;
      await this.lines.save(line);
    }

    // if no parish can be served at all, the whole plan is unfeasible
    const anyLive = ordered.some((l) => l.status === PlanLineStatus.BROADCASTING || l.status === PlanLineStatus.FILLED);
    plan.status = anyLive ? DeliveryPlanStatus.BROADCASTING : DeliveryPlanStatus.UNFEASIBLE;
    await this.plans.save(plan);
    this.realtime.emitOps('plan.broadcast', { planId: plan.id, reference: plan.reference });
    this.logger.log(`plan ${plan.reference} broadcast: ${ordered.length} parishes (scarcest-first)`);
    return this.get(plan.id);
  }

  /**
   * Re-broadcast a plan that is already broadcasting or unfeasible: re-evaluate
   * eligibility and send offers to newly-eligible drivers on unfilled parishes,
   * without re-spamming drivers who already have an offer or declined. Useful
   * after fixing a driver's eligibility/zones/availability.
   */
  async rebroadcast(planId: string): Promise<any> {
    const plan = await this.plans.findOne({ where: { id: planId }, relations: { lines: true } });
    if (!plan) throw new NotFoundException('Plan not found');
    if (plan.status !== DeliveryPlanStatus.BROADCASTING && plan.status !== DeliveryPlanStatus.UNFEASIBLE) {
      throw new BadRequestException(`Plan is ${plan.status}; only broadcasting or unfeasible plans can be re-broadcast`);
    }

    const cands = await this.candidates();
    const byId = new Map(cands.map((c) => [c.id, c]));
    const weekday = plan.operationalDate ? new Date(`${plan.operationalDate}T00:00:00Z`).getUTCDay() : null;

    let newOffers = 0;
    for (const line of plan.lines) {
      if (line.status === PlanLineStatus.FILLED || line.status === PlanLineStatus.CANCELLED) continue;

      line.eligibleCount = cands.filter((c) => this.eligibleForParish(c, line.parish, weekday)).length;

      const existing = await this.tenders.find({ where: { line: { id: line.id } }, relations: { driver: true } });
      // don't re-offer to anyone who already has a live/declined tender here
      const seen = new Set(existing.filter((t) => t.status !== PlanTenderStatus.CANCELLED).map((t) => t.driver?.id));
      let hasOpenOffers = existing.some((t) => t.status === PlanTenderStatus.OFFERED);

      // pre-assigned drivers not yet tendered (e.g. they lacked a vehicle before) auto-accept now
      for (const drvId of line.preassignedDriverIds ?? []) {
        if (seen.has(drvId)) continue;
        const c = byId.get(drvId);
        const cap = this.capacityOf(plan, c?.vehicle);
        if (!c || cap <= 0) continue;
        await this.tenders.save(this.tenders.create({ line, driver: { id: drvId } as DriverProfile, packages: cap, preassigned: true, status: PlanTenderStatus.AUTO_ACCEPTED, respondedAt: new Date() }));
        line.acceptedPackages += cap;
        seen.add(drvId);
        this.realtime.emitDriver(drvId, 'plan.tender', { lineId: line.id, parish: line.parish, packages: cap, hub: plan.hubName, preassigned: true, autoAccepted: true });
        this.notifyOffer(c.phone, line.parish, cap, plan.hubName, plan.operationalDate, true);
      }

      // offer the remainder to newly-eligible (non-pre-assigned, not-yet-tendered) drivers
      const pre = new Set(line.preassignedDriverIds ?? []);
      if (line.acceptedPackages < line.requiredPackages) {
        const eligibleNew = cands.filter((c) => this.eligibleForParish(c, line.parish, weekday) && !seen.has(c.id) && !pre.has(c.id));
        for (const c of eligibleNew) {
          const cap = this.capacityOf(plan, c.vehicle);
          if (cap <= 0) continue;
          await this.tenders.save(this.tenders.create({ line, driver: { id: c.id } as DriverProfile, packages: cap, preassigned: false, status: PlanTenderStatus.OFFERED }));
          this.realtime.emitDriver(c.id, 'plan.tender', { lineId: line.id, parish: line.parish, packages: cap, hub: plan.hubName });
          this.notifyOffer(c.phone, line.parish, cap, plan.hubName, plan.operationalDate);
          newOffers++; hasOpenOffers = true;
        }
      }

      line.status = line.acceptedPackages >= line.requiredPackages
        ? PlanLineStatus.FILLED
        : hasOpenOffers ? PlanLineStatus.BROADCASTING : PlanLineStatus.UNFEASIBLE;
      await this.lines.save(line);
    }

    const anyLive = plan.lines.some((l) => l.status === PlanLineStatus.BROADCASTING || l.status === PlanLineStatus.FILLED);
    plan.status = anyLive ? DeliveryPlanStatus.BROADCASTING : DeliveryPlanStatus.UNFEASIBLE;
    await this.plans.save(plan);
    this.realtime.emitOps('plan.broadcast', { planId: plan.id, reference: plan.reference, rebroadcast: true });
    this.logger.log(`plan ${plan.reference} re-broadcast: ${newOffers} new offers`);
    return this.get(plan.id);
  }

  /** A driver accepts a tender for their parish (adds their package chunk). */
  async accept(tenderId: string, driverId: string): Promise<any> {
    const result = await this.tenders.manager.transaction(async (em) => {
      const tender = await em.findOne(PlanTender, { where: { id: tenderId }, relations: { line: { plan: true }, driver: true } });
      if (!tender) throw new NotFoundException('Tender not found');
      if (tender.driver?.id !== driverId) throw new BadRequestException('Not your tender');
      if (tender.status !== PlanTenderStatus.OFFERED) throw new BadRequestException(`Tender is ${tender.status}`);

      // lock the line so concurrent accepts don't overshoot / race the fill
      const line = await em.findOne(DeliveryPlanLine, { where: { id: tender.line.id }, lock: { mode: 'pessimistic_write' } });
      if (!line) throw new NotFoundException('Line not found');
      if (line.status === PlanLineStatus.FILLED || line.status === PlanLineStatus.CANCELLED) {
        tender.status = PlanTenderStatus.CANCELLED;
        tender.respondedAt = new Date();
        await em.save(tender);
        throw new ConflictException('Parish already filled');
      }

      tender.status = PlanTenderStatus.ACCEPTED;
      tender.respondedAt = new Date();
      await em.save(tender);
      line.acceptedPackages += tender.packages;

      // create the driver's batch delivery (hub -> parish) so it flows into
      // the existing fulfillment/tracking pipeline (status lifecycle + GPS + score)
      const delivery = await em.save(
        em.create(Delivery, {
          driver: { id: driverId } as DriverProfile,
          parish: line.parish,
          packages: tender.packages,
          planTenderId: tender.id,
          status: DeliveryStatus.ASSIGNED,
          timeline: { assigned: new Date().toISOString() },
          trackingToken: crypto.randomBytes(12).toString('hex'),
        }),
      );

      let filled = false;
      const cancelledPhones: string[] = [];
      if (line.acceptedPackages >= line.requiredPackages) {
        line.status = PlanLineStatus.FILLED;
        filled = true;
        // cancel the remaining open offers on this line
        const others = await em.find(PlanTender, { where: { line: { id: line.id }, status: PlanTenderStatus.OFFERED }, relations: { driver: { user: true } } });
        for (const o of others) {
          o.status = PlanTenderStatus.CANCELLED;
          o.respondedAt = new Date();
          await em.save(o);
          this.realtime.emitDriver(o.driver.id, 'plan.tender.cancelled', { lineId: line.id, parish: line.parish, reason: 'filled' });
          if (o.driver.user?.phone) cancelledPhones.push(o.driver.user.phone);
        }
      }
      await em.save(line);

      // plan completion check
      const plan = tender.line.plan;
      const open = await em.count(DeliveryPlanLine, { where: { plan: { id: plan.id }, status: PlanLineStatus.BROADCASTING } });
      if (open === 0) {
        await em.update(DeliveryPlan, { id: plan.id }, { status: DeliveryPlanStatus.COMPLETED });
      }

      this.realtime.emitOps('plan.tender.accepted', { planId: plan.id, lineId: line.id, parish: line.parish, driverId, packages: tender.packages, accepted: line.acceptedPackages, required: line.requiredPackages, filled });
      return { ok: true, parish: line.parish, packages: tender.packages, accepted: line.acceptedPackages, required: line.requiredPackages, filled, deliveryId: delivery.id, trackingToken: delivery.trackingToken, _cancelledPhones: cancelledPhones, _date: plan.operationalDate };
    });

    // notify the drivers whose offers were cancelled (parish filled) — outside the tx
    if (result.filled) {
      for (const phone of result._cancelledPhones) this.notifyFilled(phone, result.parish, result._date);
    }
    const { _cancelledPhones, _date, ...pub } = result;
    return pub;
  }

  async decline(tenderId: string, driverId: string): Promise<any> {
    const tender = await this.tenders.findOne({ where: { id: tenderId }, relations: { driver: true, line: true } });
    if (!tender) throw new NotFoundException('Tender not found');
    if (tender.driver?.id !== driverId) throw new BadRequestException('Not your tender');
    if (tender.status !== PlanTenderStatus.OFFERED) return { ok: true, status: tender.status };
    tender.status = PlanTenderStatus.DECLINED;
    tender.respondedAt = new Date();
    await this.tenders.save(tender);
    return { ok: true };
  }

  /** Open tenders offered to a driver (for the driver app). */
  async driverTenders(driverId: string): Promise<any[]> {
    const rows = await this.tenders.find({
      where: { driver: { id: driverId }, status: PlanTenderStatus.OFFERED },
      relations: { line: { plan: true } },
      order: { createdAt: 'DESC' },
    });
    return rows.map((t) => ({
      id: t.id,
      parish: t.line.parish,
      packages: t.packages,
      hub: t.line.plan.hubName,
      plan: t.line.plan.reference,
    }));
  }

  async list(): Promise<any[]> {
    const rows = await this.plans.find({ order: { createdAt: 'DESC' }, take: 50 });
    return rows.map((p) => ({ id: p.id, reference: p.reference, name: p.name, status: p.status, hubName: p.hubName, operationalDate: p.operationalDate, createdAt: p.createdAt }));
  }

  async get(planId: string): Promise<any> {
    const plan = await this.plans.findOne({ where: { id: planId }, relations: { lines: true } });
    if (!plan) throw new NotFoundException('Plan not found');
    const lines = [...plan.lines].sort((a, b) => (a.broadcastOrder ?? 99) - (b.broadcastOrder ?? 99) || a.parish.localeCompare(b.parish));
    const withCounts = await Promise.all(
      lines.map(async (l) => {
        // all recipients this broadcast reached, with each one's status
        const tenders = await this.tenders.find({
          where: { line: { id: l.id } },
          relations: { driver: { user: true, vehicles: true } },
          order: { createdAt: 'ASC' },
        });
        const count = (s: PlanTenderStatus) => tenders.filter((t) => t.status === s).length;
        return {
          id: l.id,
          parish: l.parish,
          requiredPackages: l.requiredPackages,
          acceptedPackages: l.acceptedPackages,
          eligibleCount: l.eligibleCount,
          broadcastOrder: l.broadcastOrder,
          status: l.status,
          preassignedCount: l.preassignedDriverIds?.length ?? 0,
          tenders: {
            offered: count(PlanTenderStatus.OFFERED),
            accepted: count(PlanTenderStatus.ACCEPTED),
            autoAccepted: count(PlanTenderStatus.AUTO_ACCEPTED),
            declined: count(PlanTenderStatus.DECLINED),
          },
          recipients: tenders.map((t) => ({
            driverId: t.driver?.id,
            name: t.driver?.user?.fullName ?? '—',
            vehicle: t.driver?.vehicles?.[0]?.type,
            packages: t.packages,
            status: t.status,
            preassigned: t.preassigned,
          })),
        };
      }),
    );
    return {
      id: plan.id,
      reference: plan.reference,
      name: plan.name,
      hubName: plan.hubName,
      operationalDate: plan.operationalDate,
      status: plan.status,
      vehicleCapacities: plan.vehicleCapacities,
      createdAt: plan.createdAt,
      lines: withCounts,
    };
  }

  /** Every delivery-plan tender assigned to a driver (for the Ops driver panel). */
  async driverPlanHistory(driverId: string): Promise<any[]> {
    const tenders = await this.tenders.find({
      where: { driver: { id: driverId } },
      relations: { line: { plan: true } },
      order: { createdAt: 'DESC' },
    });
    return tenders.map((t) => ({
      tenderId: t.id,
      planReference: t.line?.plan?.reference,
      planName: t.line?.plan?.name,
      planStatus: t.line?.plan?.status,
      operationalDate: t.line?.plan?.operationalDate ?? null,
      parish: t.line?.parish,
      packages: t.packages,
      status: t.status,
      preassigned: t.preassigned,
      createdAt: t.createdAt,
    }));
  }

  /** Eligible drivers for the pre-assign picker (security-cleared + eligible). */
  async eligibleDrivers(): Promise<any[]> {
    const list = await this.drivers.find({ relations: { user: true, vehicles: true }, order: { score: 'DESC' } });
    return list
      .filter((d) => d.securityCleared && d.eligible)
      .map((d) => ({ id: d.id, name: d.user?.fullName ?? '—', vehicle: d.vehicles?.[0]?.type, plate: d.vehicles?.[0]?.plate }));
  }

  /**
   * The day's operating picture for the live map: every driver on a plan for the
   * given date, with their parish, package count and status. Package count is the
   * actual packages picked up once the driver has checked in; otherwise the
   * capacity-based number they were tendered.
   */
  async dayPlan(date?: string): Promise<any> {
    const day = date || new Date().toISOString().slice(0, 10);
    const plans = await this.plans.find({ where: { operationalDate: day }, relations: { lines: true } });
    const rows: any[] = [];
    for (const plan of plans) {
      for (const line of plan.lines) {
        const tenders = await this.tenders.find({
          where: { line: { id: line.id } },
          relations: { driver: { user: true, vehicles: true } },
          order: { createdAt: 'ASC' },
        });
        for (const t of tenders) {
          const dd = t.driver ? await this.driverDays.findOne({ where: { driverId: t.driver.id, operationalDate: day } }) : null;
          const delivery = await this.deliveries.findOne({ where: { planTenderId: t.id } });
          const picked = dd?.packagesPicked ?? null;
          const accepted = t.status === PlanTenderStatus.ACCEPTED || t.status === PlanTenderStatus.AUTO_ACCEPTED;
          rows.push({
            planReference: plan.reference,
            driverId: t.driver?.id,
            driver: t.driver?.user?.fullName ?? '—',
            parish: line.parish,
            vehicle: t.driver?.vehicles?.[0]?.type,
            assignedPackages: t.packages,          // capacity-based tender size
            packagesPicked: picked,                // actual, once checked in
            packages: picked != null ? picked : t.packages,
            picked: picked != null,
            tenderStatus: t.status,
            deliveryStatus: delivery?.status ?? null,
            status: accepted ? (delivery?.status ?? 'accepted') : t.status,
          });
        }
      }
    }
    // accepted/started drivers first, then by parish
    const rank = (r: any) => (['delivered'].includes(r.status) ? 3 : r.picked || ['en_route', 'picked_up', 'en_route_pickup'].includes(r.status) ? 0 : ['accepted', 'auto_accepted'].includes(r.tenderStatus) ? 1 : 2);
    rows.sort((a, b) => rank(a) - rank(b) || a.parish.localeCompare(b.parish));
    return {
      date: day,
      plans: plans.map((p) => ({ id: p.id, reference: p.reference, name: p.name, status: p.status })),
      rows,
    };
  }
}
