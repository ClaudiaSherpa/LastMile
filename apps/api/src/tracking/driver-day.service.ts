import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DriverDay } from '../database/entities';

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
    return this.dto(await this.days.save(d));
  }

  private dto(d: DriverDay) {
    const picked = d.packagesPicked;
    const success = d.successfulDeliveries;
    return {
      id: d.id,
      operationalDate: d.operationalDate,
      exists: true,
      depotArrivalAt: d.depotArrivalAt,
      packagesPicked: d.packagesPicked,
      depotDepartureAt: d.depotDepartureAt,
      startMileage: d.startMileage,
      depotReturnAt: d.depotReturnAt,
      endMileage: d.endMileage,
      successfulDeliveries: d.successfulDeliveries,
      packagesReturned: d.packagesReturned,
      mileage: d.startMileage != null && d.endMileage != null ? Math.round((d.endMileage - d.startMileage) * 10) / 10 : null,
      deliverySuccess: picked != null && picked > 0 && success != null ? Math.round((success / picked) * 100) : null,
    };
  }
}
