import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { DriverProfile } from '../database/entities';
import { WhatsAppService } from '../whatsapp/whatsapp.service';
import { DriverGroupService } from './driver-group.service';

@Injectable()
export class MessagingService {
  constructor(
    @InjectRepository(DriverProfile) private drivers: Repository<DriverProfile>,
    private whatsapp: WhatsAppService,
    private groups: DriverGroupService,
  ) {}

  /** Send a WhatsApp message to a single driver by id. */
  async sendToDriver(driverId: string, text: string) {
    if (!text?.trim()) throw new BadRequestException('Message text required');
    const driver = await this.drivers.findOne({ where: { id: driverId }, relations: { user: true } });
    if (!driver) throw new NotFoundException('Driver not found');
    const phone = driver.user?.phone;
    if (!phone) throw new BadRequestException('Driver has no phone number on file');
    const res = await this.whatsapp.send(phone, text.trim(), driverId);
    return { driverId, name: driver.user?.fullName, phone, status: res.status };
  }

  /**
   * Broadcast a message to every driver, or to one group. Returns a per-driver
   * result plus counts. Drivers with no phone are reported as skipped.
   */
  async broadcast(text: string, groupId?: string) {
    if (!text?.trim()) throw new BadRequestException('Message text required');
    let drivers: DriverProfile[];
    if (groupId) {
      const ids = await this.groups.memberIds(groupId);
      drivers = ids.length ? await this.drivers.find({ where: { id: In(ids) }, relations: { user: true } }) : [];
    } else {
      drivers = await this.drivers.find({ relations: { user: true } });
    }

    const recipients: any[] = [];
    let sent = 0, skipped = 0, failed = 0;
    for (const d of drivers) {
      const phone = d.user?.phone;
      if (!phone) { skipped++; recipients.push({ driverId: d.id, name: d.user?.fullName, phone: null, status: 'no_phone' }); continue; }
      const res = await this.whatsapp.send(phone, text.trim(), d.id);
      if (res.status === 'sent') sent++; else if (res.status === 'failed') failed++; else skipped++;
      recipients.push({ driverId: d.id, name: d.user?.fullName, phone, status: res.status });
    }
    return { total: drivers.length, sent, skipped, failed, recipients };
  }
}
