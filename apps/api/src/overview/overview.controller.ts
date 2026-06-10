import { Controller, Get } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Role } from '@sherpa/shared';
import { Roles } from '../auth/decorators';
import {
  Application,
  ApprovalStage,
  DocumentType,
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
  @Roles(Role.ADMIN, Role.DISPATCHER)
  async listDrivers() {
    const list = await this.drivers.find({
      relations: { user: true, vehicles: true, operatingAreas: true },
      order: { score: 'DESC' },
    });
    return list.map((d) => ({
      id: d.id,
      name: d.user?.fullName,
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
