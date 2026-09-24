import { Controller, Get, NotFoundException, Param, Query } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, In, Repository } from 'typeorm';
import { ApplicationStatus } from '@sherpa/shared';
import { DriverGroupService } from '../messaging/driver-group.service';
import { DeliveryStatus, Role } from '@sherpa/shared';
import { Roles } from '../auth/decorators';
import {
  Application,
  ApprovalStage,
  Delivery,
  Document,
  DocumentType,
  DriverDay,
  DriverProfile,
  Freight,
  OperatingArea,
} from '../database/entities';

/**
 * Read-only Ops surface for Phase 1: overview KPIs, driver directory and the
 * applications queue. Every route is role-gated server-side.
 */
@Controller()
export class OverviewController {
  constructor(
    @InjectRepository(DriverProfile) private drivers: Repository<DriverProfile>,
    @InjectRepository(Application) private applications: Repository<Application>,
    @InjectRepository(Freight) private freights: Repository<Freight>,
    @InjectRepository(DocumentType) private docTypes: Repository<DocumentType>,
    @InjectRepository(OperatingArea) private areas: Repository<OperatingArea>,
    @InjectRepository(ApprovalStage) private stages: Repository<ApprovalStage>,
    @InjectRepository(Delivery) private deliveries: Repository<Delivery>,
    @InjectRepository(Document) private documents: Repository<Document>,
    @InjectRepository(DriverDay) private driverDays: Repository<DriverDay>,
    private groups: DriverGroupService,
  ) {}

  @Get('overview')
  @Roles(Role.ADMIN, Role.DISPATCHER, Role.SECURITY_OFFICER)
  async overview() {
    const [drivers, applications, freights, docTypes, areas, stages] = await Promise.all([
      this.drivers.count(),
      // "in queue" = applications awaiting review (matches the approvals queue), not rejected/approved/draft
      this.applications.count({ where: { status: In([ApplicationStatus.IN_REVIEW, ApplicationStatus.RETURNED]) } }),
      this.freights.count(),
      this.docTypes.count(),
      this.areas.count(),
      this.stages.count(),
    ]);
    const moving = await this.drivers
      .createQueryBuilder('d')
      .where('d.status IN (:...s)', { s: ['enroute', 'delivering'] })
      .getCount();
    return {
      drivers,
      driversMoving: moving,
      applications,
      freights,
      config: { documentTypes: docTypes, operatingAreas: areas, approvalStages: stages },
    };
  }

  @Get('drivers')
  @Roles(Role.ADMIN, Role.DISPATCHER, Role.SECURITY_OFFICER)
  async listDrivers() {
    const list = await this.drivers.find({
      relations: { user: true, vehicles: true, operatingAreas: true },
      order: { score: 'DESC' },
    });
    return list.map((d) => ({
      id: d.id,
      name: d.user?.fullName,
      phone: d.user?.phone,
      email: d.user?.email,
      status: d.status,
      tier: d.tier,
      score: d.score,
      eligible: d.eligible,
      securityCleared: d.securityCleared,
      deliveries: d.deliveriesCount,
      acceptanceRate: d.acceptanceRate,
      onTimeRate: d.onTimeRate,
      avgRating: d.avgRating,
      vehicle: d.vehicles?.[0]?.type,
      plate: d.vehicles?.[0]?.plate,
      zones: d.operatingAreas?.map((a) => a.slug),
      lastLng: d.lastLng,
      lastLat: d.lastLat,
    }));
  }

  /**
   * Per-driver delivery breakdown for the map/driver-list detail panel:
   * total ever assigned, delivered, still pending (in-flight), and failed.
   */
  @Get('drivers/:id/delivery-stats')
  @Roles(Role.ADMIN, Role.DISPATCHER, Role.SECURITY_OFFICER)
  async driverDeliveryStats(@Param('id') id: string) {
    const driver = await this.drivers.findOne({ where: { id } });
    if (!driver) throw new NotFoundException('Driver not found');

    const rows = await this.deliveries
      .createQueryBuilder('d')
      .leftJoin('d.driver', 'dr')
      .select('d.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .where('dr.id = :id', { id })
      .groupBy('d.status')
      .getRawMany<{ status: DeliveryStatus; count: string }>();

    const byStatus = rows.reduce<Record<string, number>>((acc, r) => {
      acc[r.status] = Number(r.count);
      return acc;
    }, {});
    const assigned = Object.values(byStatus).reduce((s, n) => s + n, 0);
    const delivered = byStatus[DeliveryStatus.DELIVERED] ?? 0;
    const failed = byStatus[DeliveryStatus.FAILED] ?? 0;
    // pending = in-flight = everything not yet in a terminal state
    const pending = assigned - delivered - failed;

    return { driverId: id, assigned, delivered, pending, failed, byStatus };
  }

  /**
   * A driver's submitted documents + Terms-of-Service acceptance, for post-approval
   * review by Ops. Read-only; the file bytes are served by GET /documents/:id/file.
   */
  @Get('drivers/:id/documents')
  @Roles(Role.ADMIN, Role.DISPATCHER, Role.SECURITY_OFFICER)
  async driverDocuments(@Param('id') id: string) {
    const driver = await this.drivers.findOne({ where: { id }, relations: { user: true } });
    if (!driver) throw new NotFoundException('Driver not found');
    const docs = await this.documents.find({
      where: { driver: { id } },
      relations: { documentType: true },
      order: { createdAt: 'ASC' },
    });
    const app = await this.applications.findOne({
      where: { driver: { id } },
      order: { submittedAt: 'DESC' },
    });
    const draft = (app?.draft as Record<string, any>) ?? {};
    return {
      driverId: id,
      driver: { name: driver.user?.fullName, phone: driver.user?.phone, email: driver.user?.email, address: driver.address },
      terms: { acceptedAt: draft.termsAcceptedAt ?? null, version: draft.termsVersion ?? null },
      documents: docs.map((d) => ({
        id: d.id,
        key: d.documentType.key,
        name: d.documentType.nameEn,
        status: d.status,
        expiryDate: d.expiryDate,
        issueDate: d.issueDate,
        hasFile: !!d.fileRef,
      })),
    };
  }

  /** Depot day-sheet statistics for a driver (delivery success + mileage). */
  @Get('drivers/:id/day-stats')
  @Roles(Role.ADMIN, Role.DISPATCHER, Role.SECURITY_OFFICER)
  async driverDayStats(@Param('id') id: string) {
    const rows = await this.driverDays.find({ where: { driverId: id }, order: { operationalDate: 'DESC' } });
    const sum = (f: keyof typeof rows[number]) => rows.reduce((a, r) => a + ((r[f] as number) ?? 0), 0);
    const picked = sum('packagesPicked');
    const success = sum('successfulDeliveries');
    const returned = sum('packagesReturned');
    const mileage = rows.reduce((a, r) => a + (r.startMileage != null && r.endMileage != null ? r.endMileage - r.startMileage : 0), 0);
    // completed trips = day-sheets where the driver returned to the depot
    const completed = rows.filter((r) => r.depotReturnAt);
    const trips = completed.map((r) => ({
      operationalDate: r.operationalDate,
      departedAt: r.depotDepartureAt ?? null,
      returnedAt: r.depotReturnAt ?? null,
      packagesPicked: r.packagesPicked ?? null,
      successfulDeliveries: r.successfulDeliveries ?? null,
      packagesReturned: r.packagesReturned ?? null,
      startMileage: r.startMileage ?? null,
      endMileage: r.endMileage ?? null,
      startMileagePhoto: !!r.startMileagePhoto,
      endMileagePhoto: !!r.endMileagePhoto,
      mileage: r.startMileage != null && r.endMileage != null ? Math.round((r.endMileage - r.startMileage) * 10) / 10 : null,
      deliverySuccess: r.packagesPicked ? Math.round(((r.successfulDeliveries ?? 0) / r.packagesPicked) * 100) : null,
    }));
    return {
      days: rows.length,
      tripsCount: completed.length,
      packagesPicked: picked,
      successfulDeliveries: success,
      packagesReturned: returned,
      successRate: picked ? Math.round((success / picked) * 100) : null,
      mileage: Math.round(mileage * 10) / 10,
      trips,
      recent: rows.slice(0, 10).map((r) => ({
        operationalDate: r.operationalDate,
        packagesPicked: r.packagesPicked,
        successfulDeliveries: r.successfulDeliveries,
        packagesReturned: r.packagesReturned,
        startMileage: r.startMileage ?? null,
        endMileage: r.endMileage ?? null,
        startMileagePhoto: !!r.startMileagePhoto,
        endMileagePhoto: !!r.endMileagePhoto,
        mileage: r.startMileage != null && r.endMileage != null ? Math.round((r.endMileage - r.startMileage) * 10) / 10 : null,
        deliverySuccess: r.packagesPicked ? Math.round(((r.successfulDeliveries ?? 0) / r.packagesPicked) * 100) : null,
      })),
    };
  }

  /**
   * Operational dashboard for a period (day / week / month): fleet totals plus a
   * per-driver breakdown, computed from the day-sheets in the window.
   */
  @Get('dashboard')
  @Roles(Role.ADMIN, Role.DISPATCHER, Role.SECURITY_OFFICER)
  async dashboard(@Query('period') period = 'week', @Query('date') date?: string, @Query('groupId') groupId?: string) {
    const end = date ? new Date(`${date}T00:00:00Z`) : new Date();
    const endStr = end.toISOString().slice(0, 10);
    const start = new Date(end);
    if (period === 'day') { /* same day */ }
    else if (period === 'month') start.setUTCDate(start.getUTCDate() - 29);
    else { period = 'week'; start.setUTCDate(start.getUTCDate() - 6); }
    const startStr = start.toISOString().slice(0, 10);

    // optional group filter → restrict to that group's members
    let memberIds: string[] | null = null;
    if (groupId) {
      memberIds = await this.groups.memberIds(groupId);
      if (!memberIds.length) {
        return { period, start: startStr, end: endStr, groupId, totals: { activeDrivers: 0, daySheets: 0, packagesPicked: 0, packagesDelivered: 0, packagesReturned: 0, successRate: null, mileage: 0, onTimeRate: null }, drivers: [] };
      }
    }

    const rows = await this.driverDays.find({
      where: { operationalDate: Between(startStr, endStr), ...(memberIds ? { driverId: In(memberIds) } : {}) },
      relations: { driver: { user: true } },
    });

    const mileageOf = (r: any) => (r.startMileage != null && r.endMileage != null ? r.endMileage - r.startMileage : 0);
    const onTime = (r: any) => (r.plannedArrivalAt && r.depotArrivalAt ? (new Date(r.depotArrivalAt) <= new Date(r.plannedArrivalAt)) : null);

    // per-driver aggregation
    const byDriver = new Map<string, any>();
    for (const r of rows) {
      const id = r.driverId;
      let a = byDriver.get(id);
      if (!a) { a = { driverId: id, name: r.driver?.user?.fullName ?? '—', days: 0, picked: 0, delivered: 0, returned: 0, mileage: 0, onTime: 0, withPlanned: 0 }; byDriver.set(id, a); }
      a.days++;
      a.picked += r.packagesPicked ?? 0;
      a.delivered += r.successfulDeliveries ?? 0;
      a.returned += r.packagesReturned ?? 0;
      a.mileage += mileageOf(r);
      const ot = onTime(r);
      if (ot !== null) { a.withPlanned++; if (ot) a.onTime++; }
    }
    const drivers = [...byDriver.values()].map((a) => ({
      ...a,
      mileage: Math.round(a.mileage * 10) / 10,
      successRate: a.picked ? Math.round((a.delivered / a.picked) * 100) : null,
      onTimeRate: a.withPlanned ? Math.round((a.onTime / a.withPlanned) * 100) : null,
    })).sort((x, y) => y.delivered - x.delivered);

    const totals = drivers.reduce((s, d) => ({
      picked: s.picked + d.picked, delivered: s.delivered + d.delivered, returned: s.returned + d.returned,
      mileage: Math.round((s.mileage + d.mileage) * 10) / 10, onTime: s.onTime + d.onTime, withPlanned: s.withPlanned + d.withPlanned,
    }), { picked: 0, delivered: 0, returned: 0, mileage: 0, onTime: 0, withPlanned: 0 });

    return {
      period, start: startStr, end: endStr,
      totals: {
        activeDrivers: drivers.length,
        daySheets: rows.length,
        packagesPicked: totals.picked,
        packagesDelivered: totals.delivered,
        packagesReturned: totals.returned,
        successRate: totals.picked ? Math.round((totals.delivered / totals.picked) * 100) : null,
        mileage: totals.mileage,
        onTimeRate: totals.withPlanned ? Math.round((totals.onTime / totals.withPlanned) * 100) : null,
      },
      drivers,
    };
  }

  @Get('applications')
  @Roles(Role.ADMIN, Role.DISPATCHER, Role.SECURITY_OFFICER)
  async listApplications() {
    const list = await this.applications.find({
      relations: { currentStage: true },
      order: { submittedAt: 'DESC' },
    });
    return list.map((a) => ({
      id: a.id,
      reference: a.reference,
      name: a.applicantName,
      status: a.status,
      vehicle: a.vehicleType,
      plate: a.plate,
      zones: a.zones,
      securityChecks: a.securityChecks,
      currentStage: a.currentStage ? { nameEs: a.currentStage.nameEs, nameEn: a.currentStage.nameEn, isSecurity: a.currentStage.isSecurityClearance } : null,
      submittedAt: a.submittedAt,
    }));
  }
}
