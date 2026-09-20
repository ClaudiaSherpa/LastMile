import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DriverDay } from '../database/entities';

// day-mileage sanity thresholds (km)
const MILEAGE_WARN_KM = 100;
const MILEAGE_MAX_KM = 200;

export interface CheckInInput {
  operationalDate?: string;
  depotArrivalAt?: string;
  packagesPicked?: number;
  depotDepartureAt?: string;
  startMileage?: number;
}
export interface CheckOutInput {
  operationalDate?: string;
  depotReturnAt?: string;
  endMileage?: number;
  successfulDeliveries?: number;
  packagesReturned?: number;
}

@Injectable()
export class DriverDayService {
  constructor(@InjectRepository(DriverDay) private readonly days: Repository<DriverDay>) {}

  private today() { return new Date().toISOString().slice(0, 10); }

  private async findOrCreate(driverId: string, operationalDate: string): Promise<DriverDay> {
    let d = await this.days.findOne({ where: { driverId, operationalDate } });
    if (!d) d = this.days.create({ driverId, operationalDate });
    return d;
  }

  async getDay(driverId: string, date?: string) {
    const operationalDate = date || this.today();
    const d = await this.days.findOne({ where: { driverId, operationalDate } });
    return d ? this.dto(d) : { operationalDate, exists: false };
  }

  async checkIn(driverId: string, input: CheckInInput) {
    const d = await this.findOrCreate(driverId, input.operationalDate || this.today());
    if (input.depotArrivalAt) d.depotArrivalAt = new Date(input.depotArrivalAt);
    if (input.packagesPicked != null) d.packagesPicked = input.packagesPicked;
    if (input.depotDepartureAt) d.depotDepartureAt = new Date(input.depotDepartureAt);
    if (input.startMileage != null) d.startMileage = input.startMileage;
    return this.dto(await this.days.save(d));
  }

  async checkOut(driverId: string, input: CheckOutInput) {
    const d = await this.findOrCreate(driverId, input.operationalDate || this.today());
    if (input.depotReturnAt) d.depotReturnAt = new Date(input.depotReturnAt);
    if (input.endMileage != null) d.endMileage = input.endMileage;
    if (input.successfulDeliveries != null) d.successfulDeliveries = input.successfulDeliveries;
    if (input.packagesReturned != null) d.packagesReturned = input.packagesReturned;

    // ── validate the end-of-day figures (authoritative; the app also pre-checks) ──
    if (d.endMileage != null && d.startMileage != null) {
      if (d.endMileage <= d.startMileage) {
        throw new BadRequestException(`End mileage (${d.endMileage}) must be greater than start mileage (${d.startMileage}).`);
      }
      const dayKm = Math.round((d.endMileage - d.startMileage) * 10) / 10;
      if (dayKm > MILEAGE_MAX_KM) {
        throw new BadRequestException(`Day mileage ${dayKm} km exceeds ${MILEAGE_MAX_KM} km — please verify the odometer readings.`);
      }
    }
    // delivered + brought-back must equal what was picked up
    if (d.packagesPicked != null && d.successfulDeliveries != null && d.packagesReturned != null) {
      if (d.successfulDeliveries + d.packagesReturned !== d.packagesPicked) {
        throw new BadRequestException(
          `Delivered (${d.successfulDeliveries}) + returned (${d.packagesReturned}) must equal packages picked up (${d.packagesPicked}).`,
        );
      }
    }
    return this.dto(await this.days.save(d));
  }

  private dto(d: DriverDay) {
    const picked = d.packagesPicked;
    const success = d.successfulDeliveries;
    const mileage = d.startMileage != null && d.endMileage != null ? Math.round((d.endMileage - d.startMileage) * 10) / 10 : null;
    // route status derived from the day-sheet timestamps
    const status = d.depotReturnAt ? 'completed' : d.depotDepartureAt ? 'departed' : d.depotArrivalAt ? 'checked_in' : 'not_started';
    // punctuality: minutes late (negative = early) vs the planned hub arrival
    let arrivalDeltaMin: number | null = null;
    if (d.plannedArrivalAt && d.depotArrivalAt) {
      arrivalDeltaMin = Math.round((new Date(d.depotArrivalAt).getTime() - new Date(d.plannedArrivalAt).getTime()) / 60000);
    }
    return {
      id: d.id,
      operationalDate: d.operationalDate,
      exists: true,
      status,
      plannedArrivalAt: d.plannedArrivalAt,
      arrivalDeltaMin,
      depotArrivalAt: d.depotArrivalAt,
      packagesPicked: d.packagesPicked,
      depotDepartureAt: d.depotDepartureAt,
      startMileage: d.startMileage,
      depotReturnAt: d.depotReturnAt,
      endMileage: d.endMileage,
      successfulDeliveries: d.successfulDeliveries,
      packagesReturned: d.packagesReturned,
      mileage,
      mileageWarning: mileage != null && mileage > MILEAGE_WARN_KM && mileage <= MILEAGE_MAX_KM,
      deliverySuccess: picked != null && picked > 0 && success != null ? Math.round((success / picked) * 100) : null,
    };
  }
}
