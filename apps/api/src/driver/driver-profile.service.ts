import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { VEHICLE_CAPACITY_KG, VehicleType } from '@sherpa/shared';
import { AvailabilitySlot, DriverProfile, OperatingArea, Vehicle } from '../database/entities';

export interface UpdateProfileInput {
  vehicle?: { type?: VehicleType; plate?: string; brand?: string; model?: string; year?: number | string; color?: string };
  zones?: string[]; // operating-area slugs
  days?: number[]; // weekday 0=Sun..6=Sat
  blocks?: string[]; // madrugada|manana|tarde|noche
}

@Injectable()
export class DriverProfileService {
  constructor(
    @InjectRepository(DriverProfile) private drivers: Repository<DriverProfile>,
    @InjectRepository(Vehicle) private vehicles: Repository<Vehicle>,
    @InjectRepository(AvailabilitySlot) private slots: Repository<AvailabilitySlot>,
    @InjectRepository(OperatingArea) private areas: Repository<OperatingArea>,
  ) {}

  async get(driverId: string) {
    const d = await this.drivers.findOne({
      where: { id: driverId },
      relations: { user: true, vehicles: true, operatingAreas: true, availability: true },
    });
    if (!d) throw new NotFoundException('Driver not found');
    const v = d.vehicles?.[0];
    return {
      name: d.user?.fullName,
      phone: d.user?.phone,
      email: d.user?.email,
      status: d.status,
      eligible: d.eligible,
      securityCleared: d.securityCleared,
      vehicle: v
        ? { type: v.type, plate: v.plate, brand: v.brand, model: v.model, year: v.year, color: v.color, capacityKg: v.capacityKg }
        : null,
      zones: d.operatingAreas?.map((a) => a.slug) ?? [],
      days: Array.from(new Set((d.availability ?? []).map((s) => s.weekday))).sort((a, b) => a - b),
      blocks: Array.from(new Set((d.availability ?? []).map((s) => s.block))),
    };
  }

  async update(driverId: string, input: UpdateProfileInput) {
    const d = await this.drivers.findOne({ where: { id: driverId }, relations: { vehicles: true, operatingAreas: true } });
    if (!d) throw new NotFoundException('Driver not found');

    // vehicle
    if (input.vehicle) {
      let v = d.vehicles?.[0] ?? this.vehicles.create({ driver: d });
      if (input.vehicle.type) {
        v.type = input.vehicle.type;
        v.capacityKg = VEHICLE_CAPACITY_KG[input.vehicle.type];
      }
      if (input.vehicle.plate != null) v.plate = String(input.vehicle.plate).toUpperCase();
      if (input.vehicle.brand != null) v.brand = input.vehicle.brand;
      if (input.vehicle.model != null) v.model = input.vehicle.model;
      if (input.vehicle.color != null) v.color = input.vehicle.color;
      if (input.vehicle.year != null) v.year = parseInt(String(input.vehicle.year), 10) || undefined;
      await this.vehicles.save(v);
    }

    // operating zones
    if (Array.isArray(input.zones)) {
      d.operatingAreas = input.zones.length ? await this.areas.find({ where: { slug: In(input.zones) } }) : [];
      await this.drivers.save(d);
    }

    // availability = days × blocks (replace the driver's slots)
    if (Array.isArray(input.days) || Array.isArray(input.blocks)) {
      const existing = await this.slots.find({ where: { driver: { id: driverId } } });
      const days = input.days ?? Array.from(new Set(existing.map((s) => s.weekday)));
      const blocks = input.blocks ?? Array.from(new Set(existing.map((s) => s.block)));
      await this.slots.delete({ driver: { id: driverId } });
      const rows = days.flatMap((wd) => blocks.map((b) => this.slots.create({ driver: d, weekday: wd, block: b })));
      if (rows.length) await this.slots.save(rows);
    }

    return this.get(driverId);
  }
}
