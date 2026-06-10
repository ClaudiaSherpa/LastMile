import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Not, Repository } from 'typeorm';
import {
  DocumentStatus,
  NotificationChannel,
  Role,
} from '@sherpa/shared';
import {
  Document,
  DriverProfile,
  Reminder,
  User,
} from '../database/entities';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { computeEligibility } from '../workflow/eligibility';
import { daysUntil, reminderDue } from './reminders';

export interface ScanSummary {
  scanned: number;
  remindersSent: number;
  newlyExpired: number;
  suspended: number;
}

@Injectable()
export class ComplianceService {
  private readonly logger = new Logger('Compliance');

  constructor(
    @InjectRepository(Document) private documents: Repository<Document>,
    @InjectRepository(DriverProfile) private drivers: Repository<DriverProfile>,
    @InjectRepository(Reminder) private reminders: Repository<Reminder>,
    @InjectRepository(User) private users: Repository<User>,
    private audit: AuditService,
    private notify: NotificationsService,
  ) {}

  /** Daily compliance scan: send due reminders, expire lapsed docs, auto-suspend. */
  async runDailyScan(now: Date = new Date()): Promise<ScanSummary> {
    const docs = await this.documents.find({
      where: { documentType: { tracksExpiry: true }, expiryDate: Not(IsNull()) },
      relations: { documentType: true, driver: { user: true } },
    });
    const summary: ScanSummary = { scanned: docs.length, remindersSent: 0, newlyExpired: 0, suspended: 0 };
    const dispatchers = await this.users.find({ where: { role: Role.DISPATCHER } });

    for (const doc of docs) {
      const days = daysUntil(doc.expiryDate!, now);
      const docName = doc.documentType.nameEs;

      if (days < 0) {
        // expired
        if (doc.status !== DocumentStatus.EXPIRED) {
          doc.status = DocumentStatus.EXPIRED;
          await this.documents.save(doc);
          summary.newlyExpired++;
          await this.audit.log({
            action: 'document.expired',
            entity: 'Document',
            entityId: doc.id,
            after: { expiryDate: doc.expiryDate },
          });
          await this.notifyDriver(doc, 'doc.expired', { name: doc.driver?.user?.fullName ?? '', doc: docName });
          for (const d of dispatchers) {
            await this.notify.send({ templateKey: 'doc.expired', channel: NotificationChannel.PUSH, recipientUserId: d.id, vars: { name: doc.driver?.user?.fullName ?? '', doc: docName } });
          }
          if (doc.documentType.required && doc.driver) {
            const did = await this.recomputeEligibility(doc.driver.id, 'required_doc_expired');
            if (did) summary.suspended++;
          }
        }
        continue;
      }

      // upcoming → maybe send a reminder
      const sent = await this.reminders.find({ where: { document: { id: doc.id } } });
      const sentOffsets = sent.map((r) => r.offsetDays);
      const decision = reminderDue(days, doc.documentType.reminderOffsets ?? [], sentOffsets);
      if (decision.fire != null) {
        await this.notifyDriver(doc, 'doc.expiring', { name: doc.driver?.user?.fullName ?? '', doc: docName, days: String(days) });
        summary.remindersSent++;
        await this.reminders.save(
          decision.markSent.map((off) =>
            this.reminders.create({
              document: doc,
              templateKey: 'doc.expiring',
              scheduledFor: now,
              offsetDays: off,
              sent: true,
              sentAt: now,
            }),
          ),
        );
        this.logger.log(`reminder for ${docName} (${days}d) → ${doc.driver?.user?.fullName}`);
      }
    }
    this.logger.log(`scan: ${JSON.stringify(summary)}`);
    return summary;
  }

  /** Recompute a driver's eligibility from current docs; audit + notify on change. */
  async recomputeEligibility(driverId: string, reasonHint?: string): Promise<boolean> {
    const driver = await this.drivers.findOne({ where: { id: driverId }, relations: { user: true } });
    if (!driver) return false;
    const docs = await this.documents.find({ where: { driver: { id: driverId } }, relations: { documentType: true } });
    const res = computeEligibility(
      driver.securityCleared,
      docs.map((d) => ({ required: d.documentType.required, status: d.status, expiryDate: d.expiryDate })),
    );
    if (res.eligible === driver.eligible) return false;
    const wasEligible = driver.eligible;
    driver.eligible = res.eligible;
    await this.drivers.save(driver);
    await this.audit.log({
      action: res.eligible ? 'eligibility.restored' : 'eligibility.suspended',
      entity: 'DriverProfile',
      entityId: driver.id,
      before: { eligible: wasEligible },
      after: { eligible: res.eligible, reason: res.reason },
      reason: reasonHint,
    });
    return !res.eligible; // returns true when this call suspended the driver
  }

  /** Renew a document: extend expiry, re-approve, restore eligibility if now valid. */
  async renew(documentId: string, expiryDate: string) {
    const doc = await this.documents.findOne({
      where: { id: documentId },
      relations: { documentType: true, driver: { user: true } },
    });
    if (!doc) throw new NotFoundException('Document not found');
    doc.expiryDate = expiryDate;
    doc.status = DocumentStatus.APPROVED;
    await this.documents.save(doc);
    // clear sent reminders so the new cycle can fire again
    await this.reminders.delete({ document: { id: doc.id } });
    await this.audit.log({
      action: 'document.renewed',
      entity: 'Document',
      entityId: doc.id,
      after: { expiryDate, status: doc.status },
    });
    if (doc.driver) await this.recomputeEligibility(doc.driver.id, 'document_renewed');
    return {
      id: doc.id,
      status: doc.status,
      expiryDate: doc.expiryDate,
      driverEligible: doc.driver ? (await this.drivers.findOne({ where: { id: doc.driver.id } }))?.eligible : undefined,
    };
  }

  /** Compliance dashboard: docs expiring soon or already expired. */
  async overview(now: Date = new Date(), withinDays = 30) {
    const docs = await this.documents.find({
      where: { documentType: { tracksExpiry: true }, expiryDate: Not(IsNull()) },
      relations: { documentType: true, driver: { user: true } },
    });
    return docs
      .map((d) => ({
        id: d.id,
        document: d.documentType.nameEs,
        required: d.documentType.required,
        driver: d.driver?.user?.fullName ?? '—',
        driverId: d.driver?.id,
        expiryDate: d.expiryDate,
        daysLeft: daysUntil(d.expiryDate!, now),
        status: d.status,
      }))
      .filter((d) => d.daysLeft <= withinDays)
      .sort((a, b) => a.daysLeft - b.daysLeft);
  }

  private async notifyDriver(doc: Document, templateKey: string, vars: Record<string, string>) {
    if (!doc.driver?.user) return;
    await this.notify.send({
      templateKey,
      channel: NotificationChannel.WHATSAPP,
      locale: 'es',
      recipientUserId: doc.driver.user.id,
      vars,
    });
  }
}
