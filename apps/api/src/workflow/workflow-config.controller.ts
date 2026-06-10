import { Controller, Get } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Role } from '@sherpa/shared';
import { Roles } from '../auth/decorators';
import { ApprovalWorkflow } from '../database/entities';

/** Read-only view of the configured approval pipeline (full CRUD lands in Phase 8). */
@Controller('workflows')
export class WorkflowConfigController {
  constructor(
    @InjectRepository(ApprovalWorkflow) private workflows: Repository<ApprovalWorkflow>,
  ) {}

  @Get()
  @Roles(Role.ADMIN, Role.DISPATCHER, Role.SECURITY_OFFICER)
  async list() {
    const list = await this.workflows.find({ relations: { stages: true } });
    return list.map((w) => ({
      id: w.id,
      name: w.name,
      active: w.active,
      stages: [...w.stages]
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((s) => ({
          id: s.id,
          nameEs: s.nameEs,
          nameEn: s.nameEn,
          sortOrder: s.sortOrder,
          mode: s.mode,
          responsibleRole: s.responsibleRole,
          isSecurityClearance: s.isSecurityClearance,
          requiredDocs: s.requiredDocs,
          slaHours: s.slaHours,
        })),
    }));
  }
}
