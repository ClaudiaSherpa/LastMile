import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { DriverStatus, VEHICLE_CAPACITY_KG, VehicleType } from '@sherpa/shared';
import { AvailabilitySlot, DriverProfile, OperatingArea, User, Vehicle } from '../database/entities';

export interface UpdateProfileInput {
  // personal / contact
  name?: string;
  email?: string;
  phone?: string;
  address?: string;
  cedula?: string; // admin-only (identity)
  vehicle?: { type?: VehicleType; plate?: string; brand?: string; model?: string; year?: number | string; color?: string };
  zones?: string[]; // operating-area slugs
  days?: number[]; // weekday 0=Sun..6=Sat
  blocks?: string[]; // madrugada|manana|tarde|noche
  // security / eligibility (admin + security officer only)
  securityCleared?: boolean;
  eligible?: boolean;
  status?: DriverStatus;
}

@Injectable()
export class DriverProfileService {
  constructor(
    @InjectRepository(DriverProfile) private drivers: Repository<DriverProfile>,
    @InjectRepository(Vehicle) private vehicles: Repository<Vehicle>,
    @InjectRepository(AvailabilitySlot) private slots: Repository<AvailabilitySlot>,
    @InjectRepository(OperatingArea) private areas: Repository<OperatingArea>,
    @InjectRepository(User) private users: Repository<User>,
  ) {}

  async get(driverId: string) {
    const d = await this.drivers.findOne({
      where: { id: driverId },
      relations: { user: true, vehicles: true, operatingAreas: true, availability: true },
    });
    if (!d) throw new NotFoundException('Driver not found');
    const v = d.vehicles?.[0];
    return {
      id: d.id,
      name: d.user?.fullName,
      phone: d.user?.phone,
      email: d.user?.email,
      address: d.address,
      cedula: d.cedula,
      status: d.status,
      tier: d.tier,
      score: d.score,
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

  /** Driver self-service update — personal/contact/vehicle/availability, no security flags. */
  update(driverId: string, input: UpdateProfileInput) {
    return this.apply(driverId, input, false);
  }

  /** Ops update (admin + security officer) — everything the driver can change plus identity & security flags. */
  adminUpdate(driverId: string, input: UpdateProfileInput) {
    return this.apply(driverId, input, true);
  }

  private async apply(driverId: string, input: UpdateProfileInput, admin: boolean) {
    const d = await this.drivers.findOne({ where: { id: driverId }, relations: { user: true, vehicles: true, operatingAreas: true } });
    if (!d) throw new NotFoundException('Driver not found');

    // user contact fields (name/email/phone). phone is also the driver's login username.
    if (d.user && (input.name != null || input.email != null || input.phone != null)) {
      if (input.name != null) d.user.fullName = input.name;
      if (input.email != null) d.user.email = input.email || undefined;
      if (input.phone != null) d.user.phone = input.phone || undefined;
      try {
        await this.users.save(d.user);
      } catch (e: any) {
        if (e?.code === '23505') throw new BadRequestException('Email or phone already in use by another account');
        throw e;
      }
    }

    // driver-profile scalar fields
    let saveDriver = false;
    if (input.address != null) { d.address = input.address; saveDriver = true; }
    if (admin) {
      if (input.cedula != null) { d.cedula = input.cedula; saveDriver = true; }
      if (typeof input.securityCleared === 'boolean') { d.securityCleared = input.securityCleared; saveDriver = true; }
      if (typeof input.eligible === 'boolean') { d.eligible = input.eligible; saveDriver = true; }
      if (input.status != null) { d.status = input.status; saveDriver = true; }
    }
    if (saveDriver) await this.drivers.save(d);

    // vehicle
    if (input.vehicle) {
      const v = d.vehicles?.[0] ?? this.vehicles.create({ driver: d });
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
