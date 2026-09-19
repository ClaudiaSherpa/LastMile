import { Controller, Get, NotFoundException, Param } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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
  ) {}

  @Get('overview')
  @Roles(Role.ADMIN, Role.DISPATCHER, Role.SECURITY_OFFICER)
  async overview() {
    const [drivers, applications, freights, docTypes, areas, stages] = await Promise.all([
      this.drivers.count(),
      this.applications.count(),
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
      driver: { name: driver.user?.fullName, phone: driver.user?.phone, email: driver.user?.email },
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
    return {
      days: rows.length,
      packagesPicked: picked,
      successfulDeliveries: success,
      packagesReturned: returned,
      successRate: picked ? Math.round((success / picked) * 100) : null,
      mileage: Math.round(mileage * 10) / 10,
      recent: rows.slice(0, 10).map((r) => ({
        operationalDate: r.operationalDate,
        packagesPicked: r.packagesPicked,
        successfulDeliveries: r.successfulDeliveries,
        packagesReturned: r.packagesReturned,
        mileage: r.startMileage != null && r.endMileage != null ? Math.round((r.endMileage - r.startMileage) * 10) / 10 : null,
        deliverySuccess: r.packagesPicked ? Math.round(((r.successfulDeliveries ?? 0) / r.packagesPicked) * 100) : null,
      })),
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
