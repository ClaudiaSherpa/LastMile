import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Role } from '@sherpa/shared';
import { Roles } from '../auth/decorators';
import {
  ApprovalStage,
  ApprovalWorkflow,
  DocumentType,
  NotificationTemplate,
  OperatingArea,
} from '../database/entities';
import { AuditService } from '../audit/audit.service';

/**
 * Admin config console backend — every "configuration over hardcoding" surface is
 * editable here with no code change. Admin-only.
 */
@Controller('config')
@Roles(Role.ADMIN)
export class ConfigController {
  constructor(
    @InjectRepository(DocumentType) private docTypes: Repository<DocumentType>,
    @InjectRepository(NotificationTemplate) private templates: Repository<NotificationTemplate>,
    @InjectRepository(OperatingArea) private areas: Repository<OperatingArea>,
    @InjectRepository(ApprovalWorkflow) private workflows: Repository<ApprovalWorkflow>,
    @InjectRepository(ApprovalStage) private stages: Repository<ApprovalStage>,
    private audit: AuditService,
  ) {}

  // ── Document types ─────────────────────────────────────────────
  @Get('document-types')
  listDocTypes() {
    return this.docTypes.find({ order: { sortOrder: 'ASC' } });
  }

  @Post('document-types')
  async createDocType(@Body() body: Partial<DocumentType>) {
    const dt = await this.docTypes.save(this.docTypes.create(body));
    await this.audit.log({ action: 'config.docType.created', entity: 'DocumentType', entityId: dt.id, after: { key: dt.key } });
    return dt;
  }

  @Patch('document-types/:id')
  async updateDocType(@Param('id') id: string, @Body() body: Partial<DocumentType>) {
    await this.docTypes.update(id, body);
    await this.audit.log({ action: 'config.docType.updated', entity: 'DocumentType', entityId: id, after: body });
    return this.docTypes.findOne({ where: { id } });
  }

  @Delete('document-types/:id')
  async deleteDocType(@Param('id') id: string) {
    await this.docTypes.update(id, { active: false });
    await this.audit.log({ action: 'config.docType.deactivated', entity: 'DocumentType', entityId: id });
    return { ok: true };
  }

  // ── Notification templates ─────────────────────────────────────
  @Get('templates')
  listTemplates() {
    return this.templates.find({ order: { key: 'ASC', locale: 'ASC' } });
  }

  @Post('templates')
  async createTemplate(@Body() body: Partial<NotificationTemplate>) {
    const tpl = await this.templates.save(this.templates.create(body));
    await this.audit.log({ action: 'config.template.created', entity: 'NotificationTemplate', entityId: tpl.id, after: { key: tpl.key } });
    return tpl;
  }

  @Patch('templates/:id')
  async updateTemplate(@Param('id') id: string, @Body() body: Partial<NotificationTemplate>) {
    await this.templates.update(id, body);
    await this.audit.log({ action: 'config.template.updated', entity: 'NotificationTemplate', entityId: id });
    return this.templates.findOne({ where: { id } });
  }

  // ── Operating areas ────────────────────────────────────────────
  @Get('operating-areas')
  listAreas() {
    return this.areas.find({ order: { nameEs: 'ASC' } });
  }

  @Post('operating-areas')
  async createArea(@Body() body: Partial<OperatingArea>) {
    const a = await this.areas.save(this.areas.create(body));
    await this.audit.log({ action: 'config.area.created', entity: 'OperatingArea', entityId: a.id, after: { slug: a.slug } });
    return a;
  }

  @Patch('operating-areas/:id')
  async updateArea(@Param('id') id: string, @Body() body: Partial<OperatingArea>) {
    await this.areas.update(id, body);
    return this.areas.findOne({ where: { id } });
  }

  // ── Approval workflow / stages ─────────────────────────────────
  @Get('workflow')
  async getWorkflow() {
    const wf = await this.workflows.findOne({ where: { active: true }, relations: { stages: true } });
    if (!wf) return null;
    wf.stages = [...wf.stages].sort((a, b) => a.sortOrder - b.sortOrder);
    return wf;
  }

  @Post('workflow/stages')
  async addStage(@Body() body: Partial<ApprovalStage>) {
    const wf = await this.workflows.findOne({ where: { active: true }, relations: { stages: true } });
    if (!wf) throw new NotFoundException('No active workflow');
    const sortOrder = body.sortOrder ?? (wf.stages.length + 1);
    const stage = await this.stages.save(this.stages.create({ ...body, workflow: wf, sortOrder }));
    await this.audit.log({ action: 'config.stage.created', entity: 'ApprovalStage', entityId: stage.id, after: { nameEn: stage.nameEn } });
    return stage;
  }

  @Patch('workflow/stages/:id')
  async updateStage(@Param('id') id: string, @Body() body: Partial<ApprovalStage>) {
    await this.stages.update(id, body);
    await this.audit.log({ action: 'config.stage.updated', entity: 'ApprovalStage', entityId: id, after: body });
    return this.stages.findOne({ where: { id } });
  }

  @Delete('workflow/stages/:id')
  async deleteStage(@Param('id') id: string) {
    await this.stages.delete(id);
    await this.audit.log({ action: 'config.stage.deleted', entity: 'ApprovalStage', entityId: id });
    return { ok: true };
  }

  /** Reorder stages: body { order: [stageId, ...] } sets sortOrder by index. */
  @Post('workflow/reorder')
  async reorder(@Body() body: { order: string[] }) {
    await Promise.all(body.order.map((id, i) => this.stages.update(id, { sortOrder: i + 1 })));
    await this.audit.log({ action: 'config.workflow.reordered', entity: 'ApprovalWorkflow', after: { order: body.order } });
    return { ok: true };
  }
}
