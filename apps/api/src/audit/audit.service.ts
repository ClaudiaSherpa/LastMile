import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from '../database/entities';

export interface AuditInput {
  actorUserId?: string;
  actorName?: string;
  action: string;
  entity: string;
  entityId?: string;
  before?: Record<string, any>;
  after?: Record<string, any>;
  reason?: string;
}

@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(AuditLog) private readonly repo: Repository<AuditLog>,
  ) {}

  log(input: AuditInput): Promise<AuditLog> {
    return this.repo.save(this.repo.create(input));
  }

  find(entity?: string, entityId?: string): Promise<AuditLog[]> {
    const where: any = {};
    if (entity) where.entity = entity;
    if (entityId) where.entityId = entityId;
    return this.repo.find({ where, order: { createdAt: 'DESC' }, take: 200 });
  }
}
