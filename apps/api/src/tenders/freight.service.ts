import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FreightStatus } from '@sherpa/shared';
import { Freight, OperatingArea } from '../database/entities';
import { CreateFreightDto } from './dto';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class FreightService {
  constructor(
    @InjectRepository(Freight) private freights: Repository<Freight>,
    @InjectRepository(OperatingArea) private areas: Repository<OperatingArea>,
    private audit: AuditService,
  ) {}

  async create(dto: CreateFreightDto, actor?: string) {
    const [pickup, drop] = await Promise.all([
      this.areas.findOne({ where: { slug: dto.pickupZone } }),
      this.areas.findOne({ where: { slug: dto.dropZone } }),
    ]);
    const reference = await this.nextReference();
    const point = (a?: OperatingArea | null) =>
      a?.centerLng != null && a?.centerLat != null
        ? { type: 'Point', coordinates: [a.centerLng, a.centerLat] }
        : undefined;

    const freight = await this.freights.save(
      this.freights.create({
        reference,
        client: dto.client,
        consigneeName: dto.consigneeName,
        consigneePhone: dto.consigneePhone,
        pickupZone: dto.pickupZone,
        dropZone: dto.dropZone,
        pickupPoint: point(pickup),
        dropPoint: point(drop),
        requiredVehicle: dto.requiredVehicle,
        weightKg: dto.weightKg,
        windowMinutes: dto.windowMinutes,
        distanceKm: dto.distanceKm,
        payout: dto.payout,
        priority: dto.priority ?? false,
        status: FreightStatus.AVAILABLE,
      }),
    );
    await this.audit.log({ actorName: actor, action: 'freight.created', entity: 'Freight', entityId: freight.id, after: { reference } });
    return freight;
  }

  async list() {
    const list = await this.freights.find({ relations: { assignedDriver: { user: true } }, order: { createdAt: 'DESC' } });
    return list.map((f) => ({
      id: f.id,
      reference: f.reference,
      client: f.client,
      pickupZone: f.pickupZone,
      dropZone: f.dropZone,
      requiredVehicle: f.requiredVehicle,
      weightKg: f.weightKg,
      payout: f.payout,
      distanceKm: f.distanceKm,
      windowMinutes: f.windowMinutes,
      priority: f.priority,
      status: f.status,
      assignedTo: f.assignedDriver?.user?.fullName ?? null,
    }));
  }

  private async nextReference(): Promise<string> {
    const count = await this.freights.count();
    let n = 4820 + count;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const ref = `F-${n}`;
      if (!(await this.freights.findOne({ where: { reference: ref } }))) return ref;
      n++;
    }
  }
}
