import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { MassAcceptanceStatus, MassTender, MassTenderAcceptance, DriverDay, DriverProfile } from '../database/entities';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { WhatsAppService } from '../whatsapp/whatsapp.service';

const toMin = (hhmm: string) => { const [h, m] = (hhmm || '').split(':').map(Number); return (h || 0) * 60 + (m || 0); };
const toHHMM = (min: number) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

export interface MassTenderInput {
  name?: string;
  operationalDate: string;
  hubName?: string;
  windowStart: string;
  windowEnd: string;
  slotMinutes: number;
  maxConcurrent: number;
  driversNeeded: number;
}

@Injectable()
export class MassTenderService {
  constructor(
    @InjectRepository(MassTender) private tenders: Repository<MassTender>,
    @InjectRepository(MassTenderAcceptance) private accs: Repository<MassTenderAcceptance>,
    @InjectRepository(DriverProfile) private drivers: Repository<DriverProfile>,
    @InjectRepository(DriverDay) private days: Repository<DriverDay>,
    private dataSource: DataSource,
    private realtime: RealtimeGateway,
    private whatsapp: WhatsAppService,
  ) {}

  /** The fixed loading slots derived from the pickup window + slot length. */
  private slots(t: MassTender): { start: string; end: string }[] {
    const out: { start: string; end: string }[] = [];
    const end = toMin(t.windowEnd);
    const step = Math.max(1, t.slotMinutes);
    for (let s = toMin(t.windowStart); s + step <= end; s += step) out.push({ start: toHHMM(s), end: toHHMM(s + step) });
    return out;
  }

  private async dto(t: MassTender, acceptances?: MassTenderAcceptance[]) {
    const accs = acceptances ?? await this.accs.find({ where: { massTenderId: t.id }, relations: { driver: { user: true } } });
    const active = accs.filter((a) => a.status === 'accepted');
    const bySlot = new Map<string, number>();
    for (const a of active) bySlot.set(a.slotStart, (bySlot.get(a.slotStart) ?? 0) + 1);
    const accepted = active.length;
    const slots = this.slots(t).map((s) => {
      const count = bySlot.get(s.start) ?? 0;
      return { start: s.start, end: s.end, label: `${s.start}–${s.end}`, accepted: count, capacity: t.maxConcurrent, full: count >= t.maxConcurrent };
    });
    return {
      id: t.id, reference: t.reference, name: t.name ?? null, status: t.status,
      operationalDate: t.operationalDate, hubName: t.hubName,
      windowStart: t.windowStart, windowEnd: t.windowEnd, slotMinutes: t.slotMinutes,
      maxConcurrent: t.maxConcurrent, driversNeeded: t.driversNeeded,
      accepted, remaining: Math.max(0, t.driversNeeded - accepted), createdBy: t.createdBy ?? null,
      createdAt: t.createdAt, updatedAt: t.updatedAt, slots,
      acceptanceList: active.map((a) => ({ driverId: a.driverId, driver: a.driver?.user?.fullName ?? '—', slotStart: a.slotStart, acceptedAt: a.acceptedAt })),
    };
  }

  // ── ops ──────────────────────────────────────────────────────────
  async create(input: MassTenderInput, createdBy?: string) {
    if (!input?.operationalDate) throw new BadRequestException('Operational date is required');
    if (toMin(input.windowEnd) - toMin(input.windowStart) < (input.slotMinutes || 0))
      throw new BadRequestException('The pickup window must be at least one slot long');
    if (!(input.slotMinutes > 0) || !(input.maxConcurrent > 0) || !(input.driversNeeded > 0))
      throw new BadRequestException('Slot length, drivers per window and drivers needed must be positive');
    const count = await this.tenders.count();
    const t = await this.tenders.save(this.tenders.create({
      reference: `MT-${1001 + count}`,
      name: input.name?.trim() || undefined,
      operationalDate: input.operationalDate,
      hubName: input.hubName?.trim() || 'PasarEx Hub',
      windowStart: input.windowStart, windowEnd: input.windowEnd,
      slotMinutes: input.slotMinutes, maxConcurrent: input.maxConcurrent, driversNeeded: input.driversNeeded,
      status: 'draft', createdBy,
    }));
    return this.dto(t, []);
  }

  async list() {
    const rows = await this.tenders.find({ order: { createdAt: 'DESC' } });
    const accs = await this.accs.find();
    return Promise.all(rows.map((t) => this.dto(t, accs.filter((a) => a.massTenderId === t.id))));
  }

  async get(id: string) {
    const t = await this.tenders.findOne({ where: { id } });
    if (!t) throw new NotFoundException('Mass tender not found');
    return this.dto(t);
  }

  /** Drivers that may be offered this tender: cleared, eligible, available that weekday. */
  private async eligibleDrivers(t: MassTender) {
    const weekday = new Date(`${t.operationalDate}T00:00:00Z`).getUTCDay();
    const all = await this.drivers.find({ relations: { user: true, availability: true } });
    return all.filter((d) =>
      d.securityCleared && d.eligible &&
      (d.availability ?? []).some((a) => a.weekday === weekday));
  }

  async open(id: string) {
    const t = await this.tenders.findOne({ where: { id } });
    if (!t) throw new NotFoundException('Mass tender not found');
    if (t.status !== 'draft' && t.status !== 'closed') throw new BadRequestException('Only a draft or closed call can be opened');
    t.status = 'open';
    await this.tenders.save(t);
    const eligible = await this.eligibleDrivers(t);
    const niceDate = t.operationalDate;
    for (const d of eligible) {
      this.realtime.emitDriver(d.id, 'mass.tender', { id: t.id, reference: t.reference });
      if (d.user?.phone) {
        const text = `📦 Convocatoria PasarEx (${t.reference}): se necesitan ${t.driversNeeded} conductores en ${t.hubName} el ${niceDate}, entre ${t.windowStart} y ${t.windowEnd}. Abre la app y elige tu franja de carga. / Open call: pick a loading window in the app.`;
        this.whatsapp.send(d.user.phone, text, d.id).catch(() => {});
      }
    }
    this.realtime.emitOps('mass.tender.updated', { id: t.id, status: t.status });
    return this.dto(t);
  }

  async close(id: string) {
    const t = await this.tenders.findOne({ where: { id } });
    if (!t) throw new NotFoundException('Mass tender not found');
    if (t.status === 'cancelled') throw new BadRequestException('This call is cancelled');
    t.status = 'closed';
    await this.tenders.save(t);
    this.realtime.emitOps('mass.tender.updated', { id: t.id, status: t.status });
    return this.dto(t);
  }

  async cancel(id: string) {
    const t = await this.tenders.findOne({ where: { id } });
    if (!t) throw new NotFoundException('Mass tender not found');
    t.status = 'cancelled';
    await this.tenders.save(t);
    const active = await this.accs.find({ where: { massTenderId: t.id }, relations: { driver: { user: true } } });
    for (const a of active.filter((x) => x.status === 'accepted')) {
      this.realtime.emitDriver(a.driverId, 'mass.tender.cancelled', { id: t.id, reference: t.reference });
      if (a.driver?.user?.phone) this.whatsapp.send(a.driver.user.phone, `La convocatoria ${t.reference} fue cancelada. / Open call ${t.reference} was cancelled.`, a.driverId).catch(() => {});
    }
    this.realtime.emitOps('mass.tender.updated', { id: t.id, status: t.status });
    return this.dto(t);
  }

  async remove(id: string) {
    const t = await this.tenders.findOne({ where: { id } });
    if (!t) throw new NotFoundException('Mass tender not found');
    await this.tenders.remove(t);
    this.realtime.emitOps('mass.tender.updated', { id, status: 'deleted' });
    return { ok: true };
  }

  // ── driver ───────────────────────────────────────────────────────
  /** Open calls a driver may take, with live slot availability + their own pick. */
  async driverTenders(driverId: string) {
    const driver = await this.drivers.findOne({ where: { id: driverId }, relations: { availability: true } });
    if (!driver) return [];
    const open = await this.tenders.find({ where: { status: 'open' }, order: { operationalDate: 'ASC' } });
    const myAccs = await this.accs.find({ where: { driverId } });
    const out: any[] = [];
    for (const t of open) {
      const weekday = new Date(`${t.operationalDate}T00:00:00Z`).getUTCDay();
      const available = driver.securityCleared && driver.eligible && (driver.availability ?? []).some((a) => a.weekday === weekday);
      const mine = myAccs.find((a) => a.massTenderId === t.id && a.status === 'accepted');
      if (!available && !mine) continue;
      const d = await this.dto(t);
      out.push({ ...d, mySlot: mine?.slotStart ?? null });
    }
    return out;
  }

  async accept(id: string, driverId: string, slotStart: string) {
    return this.dataSource.transaction(async (mgr) => {
      const t = await mgr.findOne(MassTender, { where: { id }, lock: { mode: 'pessimistic_write' } });
      if (!t) throw new NotFoundException('Mass tender not found');
      if (t.status !== 'open') throw new ConflictException('This open call is closed');
      if (!this.slots(t).some((s) => s.start === slotStart)) throw new BadRequestException('Invalid loading window');

      const accs = await mgr.find(MassTenderAcceptance, { where: { massTenderId: id } });
      const mine = accs.find((a) => a.driverId === driverId);
      const othersActive = accs.filter((a) => a.status === 'accepted' && a.driverId !== driverId);
      if (!mine?.status || mine.status !== 'accepted') {
        if (othersActive.length >= t.driversNeeded) throw new ConflictException('This open call is full');
      }
      const inSlot = othersActive.filter((a) => a.slotStart === slotStart).length;
      if (inSlot >= t.maxConcurrent) throw new ConflictException('That loading window is full');

      if (mine) { mine.slotStart = slotStart; mine.status = 'accepted'; mine.acceptedAt = new Date(); await mgr.save(mine); }
      else await mgr.save(mgr.create(MassTenderAcceptance, { massTenderId: id, driverId, slotStart, status: 'accepted' as MassAcceptanceStatus, acceptedAt: new Date() }));

      // seed the driver's planned hub arrival so on-time tracking still works
      const planned = new Date(`${t.operationalDate}T${slotStart.padStart(5, '0')}:00-04:00`);
      let dd = await mgr.findOne(DriverDay, { where: { driverId, operationalDate: t.operationalDate } });
      if (!dd) dd = mgr.create(DriverDay, { driverId, operationalDate: t.operationalDate });
      dd.plannedArrivalAt = planned;
      await mgr.save(dd);

      const nowActive = othersActive.length + 1;
      if (nowActive >= t.driversNeeded) { t.status = 'filled'; await mgr.save(t); }

      this.realtime.emitOps('mass.tender.accepted', { id: t.id, driverId, slotStart, accepted: nowActive, needed: t.driversNeeded, filled: t.status === 'filled' });
      return { ok: true, slotStart, accepted: nowActive, needed: t.driversNeeded, filled: t.status === 'filled' };
    });
  }

  async withdraw(id: string, driverId: string) {
    const t = await this.tenders.findOne({ where: { id } });
    if (!t) throw new NotFoundException('Mass tender not found');
    const mine = await this.accs.findOne({ where: { massTenderId: id, driverId } });
    if (!mine || mine.status !== 'accepted') return { ok: true };
    mine.status = 'withdrawn';
    await this.accs.save(mine);
    if (t.status === 'filled') { t.status = 'open'; await this.tenders.save(t); } // a slot freed up
    this.realtime.emitOps('mass.tender.accepted', { id: t.id, driverId, withdrawn: true });
    return { ok: true };
  }
}
