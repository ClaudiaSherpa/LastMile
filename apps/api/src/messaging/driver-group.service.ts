import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { DriverGroup, DriverProfile } from '../database/entities';

export interface GroupInput {
  name?: string;
  color?: string;
  driverIds?: string[];
}

@Injectable()
export class DriverGroupService {
  constructor(
    @InjectRepository(DriverGroup) private groups: Repository<DriverGroup>,
    @InjectRepository(DriverProfile) private drivers: Repository<DriverProfile>,
  ) {}

  private dto(g: DriverGroup) {
    return {
      id: g.id,
      name: g.name,
      color: g.color ?? null,
      driverIds: (g.drivers ?? []).map((d) => d.id),
      count: (g.drivers ?? []).length,
    };
  }

  async list() {
    const rows = await this.groups.find({ relations: { drivers: true }, order: { name: 'ASC' } });
    return rows.map((g) => this.dto(g));
  }

  private async resolveDrivers(ids?: string[]): Promise<DriverProfile[]> {
    if (!ids || !ids.length) return [];
    return this.drivers.find({ where: { id: In(ids) } });
  }

  async create(input: GroupInput) {
    const g = this.groups.create({
      name: input.name?.trim() || 'Group',
      color: input.color,
      drivers: await this.resolveDrivers(input.driverIds),
    });
    return this.dto(await this.groups.save(g));
  }

  async update(id: string, input: GroupInput) {
    const g = await this.groups.findOne({ where: { id }, relations: { drivers: true } });
    if (!g) throw new NotFoundException('Group not found');
    if (input.name != null) g.name = input.name.trim();
    if (input.color !== undefined) g.color = input.color;
    if (Array.isArray(input.driverIds)) g.drivers = await this.resolveDrivers(input.driverIds);
    return this.dto(await this.groups.save(g));
  }

  async remove(id: string) {
    const g = await this.groups.findOne({ where: { id } });
    if (!g) throw new NotFoundException('Group not found');
    await this.groups.remove(g);
    return { ok: true };
  }

  /** Driver-profile ids that belong to a group (for broadcast targeting). */
  async memberIds(groupId: string): Promise<string[]> {
    const g = await this.groups.findOne({ where: { id: groupId }, relations: { drivers: true } });
    if (!g) throw new NotFoundException('Group not found');
    return g.drivers.map((d) => d.id);
  }
}
