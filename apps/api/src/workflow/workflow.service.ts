import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import {
  ApplicationStatus,
  ApprovalOutcome,
  DocumentStatus,
  JwtPayload,
  NotificationChannel,
  Role,
  SecurityCheckResult,
  StageMode,
  TaskStatus,
} from '@sherpa/shared';
import {
  Application,
  ApprovalStage,
  ApprovalTask,
  Document,
  DriverProfile,
} from '../database/entities';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { computeEligibility } from './eligibility';

const EDITABLE = [ApplicationStatus.IN_REVIEW, ApplicationStatus.RETURNED];

@Injectable()
export class WorkflowService {
  private readonly logger = new Logger('Workflow');

  constructor(
    @InjectRepository(Application) private apps: Repository<Application>,
    @InjectRepository(ApprovalTask) private tasks: Repository<ApprovalTask>,
    @InjectRepository(DriverProfile) private drivers: Repository<DriverProfile>,
    @InjectRepository(Document) private documents: Repository<Document>,
    private audit: AuditService,
    private notify: NotificationsService,
  ) {}

  // ── stage helpers ──────────────────────────────────────────────
  private ordered(app: Application): ApprovalStage[] {
    return [...(app.workflow?.stages ?? [])].sort((a, b) => a.sortOrder - b.sortOrder);
  }
  private nextAfter(app: Application, stage: ApprovalStage): ApprovalStage | undefined {
    const list = this.ordered(app);
    const i = list.findIndex((s) => s.id === stage.id);
    return i >= 0 ? list[i + 1] : undefined;
  }

  private async reload(id: string): Promise<Application> {
    const app = await this.apps.findOne({
      where: { id },
      relations: { workflow: { stages: true }, currentStage: true, driver: { user: true } },
    });
    if (!app) throw new NotFoundException('Application not found');
    return app;
  }

  /** Kick a freshly-submitted application into its workflow (runs automatic stages). */
  async start(applicationId: string): Promise<void> {
    const app = await this.reload(applicationId);
    const first = this.ordered(app)[0];
    if (!first) return;
    app.currentStage = first;
    await this.apps.save(app);
    if (first.mode === StageMode.AUTOMATIC) await this.runAutomatic(app.id);
  }

  // ── automatic-stage evaluation ─────────────────────────────────
  private async evaluateAuto(app: Application, stage: ApprovalStage): Promise<{ pass: boolean; reason: string }> {
    const rules = stage.ruleset ?? {};
    if (rules.requireAllRequiredDocs && app.driver) {
      const docs = await this.documents.find({
        where: { driver: { id: app.driver.id } },
        relations: { documentType: true },
      });
      const present = new Set(docs.map((d) => d.documentType.key));
      const requiredKeys: string[] = stage.requiredDocs?.length
        ? stage.requiredDocs
        : docs.filter((d) => d.documentType.required).map((d) => d.documentType.key);
      const missing = requiredKeys.filter((k) => !present.has(k));
      if (missing.length) return { pass: false, reason: `missing_docs:${missing.join(',')}` };
      // auto-approve the uploaded docs at this gate
      await this.documents.update(
        { id: In(docs.map((d) => d.id)) },
        { status: DocumentStatus.APPROVED },
      );
    }
    return { pass: true, reason: 'ok' };
  }

  private async runAutomatic(applicationId: string): Promise<Application> {
    let app = await this.reload(applicationId);
    // guard against misconfigured infinite loops
    for (let guard = 0; guard < 25; guard++) {
      const stage = app.currentStage;
      if (!stage || stage.mode !== StageMode.AUTOMATIC) break;
      const res = await this.evaluateAuto(app, stage);
      await this.tasks.save(
        this.tasks.create({
          application: app,
          stage,
          status: res.pass ? TaskStatus.PASSED : TaskStatus.FAILED,
          decidedByName: 'system',
          reason: res.reason,
          decidedAt: new Date(),
        }),
      );
      await this.audit.log({
        action: res.pass ? 'stage.auto.passed' : 'stage.auto.failed',
        entity: 'Application',
        entityId: app.id,
        after: { stage: stage.nameEn, reason: res.reason },
      });
      if (!res.pass) return this.finalizeRejected(app, res.reason);
      const next = this.nextAfter(app, stage);
      if (!next) return this.finalizeApproved(app);
      app.currentStage = next;
      await this.apps.save(app);
      app = await this.reload(app.id);
    }
    return app;
  }

  // ── manual decision ────────────────────────────────────────────
  async decide(user: JwtPayload, applicationId: string, outcome: ApprovalOutcome, reason?: string) {
    const app = await this.reload(applicationId);
    const stage = app.currentStage;
    if (!stage) throw new BadRequestException('Application has no active stage');
    if (!EDITABLE.includes(app.status)) throw new BadRequestException(`Application is ${app.status}`);
    if (stage.mode !== StageMode.MANUAL) throw new BadRequestException('Current stage is automatic');
    if (user.role !== stage.responsibleRole && user.role !== Role.ADMIN) {
      throw new ForbiddenException(`Stage "${stage.nameEn}" is handled by ${stage.responsibleRole}`);
    }

    await this.tasks.save(
      this.tasks.create({
        application: app,
        stage,
        status:
          outcome === ApprovalOutcome.PASS
            ? TaskStatus.PASSED
            : outcome === ApprovalOutcome.FAIL
              ? TaskStatus.FAILED
              : TaskStatus.RETURNED,
        decidedByUserId: user.sub,
        decidedByName: user.email,
        reason,
        decidedAt: new Date(),
      }),
    );
    await this.audit.log({
      actorUserId: user.sub,
      actorName: user.email,
      action: `stage.${outcome}`,
      entity: 'Application',
      entityId: app.id,
      after: { stage: stage.nameEn },
      reason,
    });

    if (outcome === ApprovalOutcome.RETURN) {
      app.status = ApplicationStatus.RETURNED;
      await this.apps.save(app);
      await this.notifyDriver(app, 'application.rejected', { reason: reason ?? 'returned' });
      return this.view(await this.reload(app.id));
    }
    if (outcome === ApprovalOutcome.FAIL) {
      return this.view(await this.finalizeRejected(app, reason ?? 'failed'));
    }

    // PASS
    if (stage.isSecurityClearance && app.driver) {
      app.driver.securityCleared = true;
      await this.drivers.save(app.driver);
      await this.audit.log({
        actorUserId: user.sub,
        actorName: user.email,
        action: 'eligibility.security_cleared',
        entity: 'DriverProfile',
        entityId: app.driver.id,
        after: { securityCleared: true },
        reason,
      });
    }
    const next = this.nextAfter(app, stage);
    if (!next) return this.view(await this.finalizeApproved(app));
    app.currentStage = next;
    await this.apps.save(app);
    if (next.mode === StageMode.AUTOMATIC) return this.view(await this.runAutomatic(app.id));
    return this.view(await this.reload(app.id));
  }

  // ── finalizers ─────────────────────────────────────────────────
  private async finalizeApproved(app: Application): Promise<Application> {
    app.status = ApplicationStatus.APPROVED;
    app.score = app.score ?? 70;
    await this.apps.save(app);

    if (app.driver) {
      const docs = await this.documents.find({
        where: { driver: { id: app.driver.id } },
        relations: { documentType: true },
      });
      const elig = computeEligibility(
        app.driver.securityCleared,
        docs.map((d) => ({ required: d.documentType.required, status: d.status, expiryDate: d.expiryDate, tracksExpiry: d.documentType.tracksExpiry })),
      );
      app.driver.eligible = elig.eligible;
      await this.drivers.save(app.driver);
      await this.audit.log({
        action: 'eligibility.changed',
        entity: 'DriverProfile',
        entityId: app.driver.id,
        after: { eligible: elig.eligible, reason: elig.reason },
      });
    }
    await this.notifyDriver(app, 'application.approved', { name: app.applicantName ?? 'Conductor' });
    this.logger.log(`application ${app.reference} approved`);
    return this.reload(app.id);
  }

  private async finalizeRejected(app: Application, reason: string): Promise<Application> {
    app.status = ApplicationStatus.REJECTED;
    await this.apps.save(app);
    if (app.driver) {
      app.driver.eligible = false;
      await this.drivers.save(app.driver);
    }
    await this.audit.log({ action: 'application.rejected', entity: 'Application', entityId: app.id, reason });
    await this.notifyDriver(app, 'application.rejected', { reason });
    return this.reload(app.id);
  }

  private async notifyDriver(app: Application, templateKey: string, vars: Record<string, string>) {
    if (!app.driver?.user) return;
    await this.notify.send({
      templateKey,
      channel: NotificationChannel.PUSH,
      locale: 'es',
      recipientUserId: app.driver.user.id,
      vars,
    });
  }

  // ── security sub-checks ────────────────────────────────────────
  async setSecurityCheck(user: JwtPayload, applicationId: string, check: string, result: SecurityCheckResult) {
    const app = await this.reload(applicationId);
    app.securityChecks = { ...(app.securityChecks ?? {}), [check]: result };
    await this.apps.save(app);
    await this.audit.log({
      actorUserId: user.sub,
      actorName: user.email,
      action: 'security.check',
      entity: 'Application',
      entityId: app.id,
      after: { [check]: result },
    });
    return this.view(await this.reload(app.id));
  }

  // ── read models ────────────────────────────────────────────────
  async queue(user: JwtPayload) {
    const apps = await this.apps.find({
      where: { status: In([ApplicationStatus.IN_REVIEW, ApplicationStatus.RETURNED]) },
      relations: { currentStage: true },
      order: { submittedAt: 'ASC' },
    });
    // dispatchers/security see the stages they own; admin sees everything
    const visible = apps.filter(
      (a) => user.role === Role.ADMIN || !a.currentStage || a.currentStage.responsibleRole === user.role,
    );
    return visible.map((a) => this.row(a));
  }

  async detail(applicationId: string) {
    const app = await this.reload(applicationId);
    const docs = app.driver
      ? await this.documents.find({
          where: { driver: { id: app.driver.id } },
          relations: { documentType: true },
        })
      : [];
    const tasks = await this.tasks.find({
      where: { application: { id: app.id } },
      relations: { stage: true },
      order: { createdAt: 'ASC' },
    });
    const draft = app.draft ?? {};
    return {
      ...this.row(app),
      draft: app.driver ? undefined : app.draft,
      // Terms-of-Service acceptance recorded at apply time (kept on the application draft).
      terms: {
        acceptedAt: draft.termsAcceptedAt ?? null,
        version: draft.termsVersion ?? null,
      },
      documents: docs.map((d) => ({
        id: d.id,
        key: d.documentType.key,
        name: d.documentType.nameEn,
        status: d.status,
        expiryDate: d.expiryDate,
        issueDate: d.issueDate,
        hasFile: !!d.fileRef,
      })),
      history: tasks.map((t) => ({
        stage: t.stage?.nameEs,
        status: t.status,
        by: t.decidedByName,
        reason: t.reason,
        at: t.decidedAt,
      })),
    };
  }

  private row(a: Application) {
    return {
      id: a.id,
      reference: a.reference,
      name: a.applicantName,
      status: a.status,
      vehicle: a.vehicleType,
      plate: a.plate,
      zones: a.zones,
      score: a.score,
      securityChecks: a.securityChecks,
      currentStage: a.currentStage
        ? {
            id: a.currentStage.id,
            nameEs: a.currentStage.nameEs,
            nameEn: a.currentStage.nameEn,
            mode: a.currentStage.mode,
            responsibleRole: a.currentStage.responsibleRole,
            isSecurity: a.currentStage.isSecurityClearance,
          }
        : null,
      submittedAt: a.submittedAt,
    };
  }

  private view(app: Application) {
    return this.row(app);
  }
}
