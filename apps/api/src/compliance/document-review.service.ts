import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DocumentStatus } from '@sherpa/shared';
import { Document } from '../database/entities';
import { AuditService } from '../audit/audit.service';
import { WhatsAppService } from '../whatsapp/whatsapp.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { env } from '../config/env';
import { ComplianceService } from './compliance.service';

@Injectable()
export class DocumentReviewService {
  constructor(
    @InjectRepository(Document) private documents: Repository<Document>,
    private compliance: ComplianceService,
    private whatsapp: WhatsAppService,
    private audit: AuditService,
    private realtime: RealtimeGateway,
  ) {}

  /** All documents awaiting review (newest uploads first). */
  async listPending() {
    const docs = await this.documents.find({
      where: { status: DocumentStatus.PENDING },
      relations: { documentType: true, driver: { user: true } },
      order: { updatedAt: 'DESC' },
    });
    return docs.map((d) => ({
      id: d.id,
      driverId: d.driver?.id,
      driverName: d.driver?.user?.fullName,
      phone: d.driver?.user?.phone,
      docKey: d.documentType?.key,
      docName: d.documentType?.nameEn,
      docNameEs: d.documentType?.nameEs,
      required: d.documentType?.required,
      expiryDate: d.expiryDate ?? null,
      issueDate: d.issueDate ?? null,
      hasFile: !!d.fileRef,
      uploadedAt: d.updatedAt,
    }));
  }

  async count() {
    return { pending: await this.documents.count({ where: { status: DocumentStatus.PENDING } }) };
  }

  private async load(id: string) {
    const doc = await this.documents.findOne({ where: { id }, relations: { documentType: true, driver: { user: true } } });
    if (!doc) throw new NotFoundException('Document not found');
    return doc;
  }

  async approve(id: string, reviewer?: string) {
    const doc = await this.load(id);
    doc.status = DocumentStatus.APPROVED;
    doc.rejectionReason = undefined;
    await this.documents.save(doc);
    await this.audit.log({ action: 'document.approved', entity: 'Document', entityId: doc.id, after: { status: doc.status }, reason: reviewer });
    if (doc.driver) await this.compliance.recomputeEligibility(doc.driver.id, 'document_approved');
    this.realtime.emitOps('document.reviewed', { id: doc.id, status: doc.status });
    return { id: doc.id, status: doc.status };
  }

  async reject(id: string, reason: string, reviewer?: string) {
    if (!reason?.trim()) throw new BadRequestException('A rejection reason is required');
    const doc = await this.load(id);
    doc.status = DocumentStatus.REJECTED;
    doc.rejectionReason = reason.trim();
    await this.documents.save(doc);
    await this.audit.log({ action: 'document.rejected', entity: 'Document', entityId: doc.id, after: { status: doc.status, reason: reason.trim() }, reason: reviewer });
    // a rejected required doc should suspend eligibility
    if (doc.driver) await this.compliance.recomputeEligibility(doc.driver.id, 'document_rejected');

    // notify the driver over WhatsApp so they can re-upload a corrected version
    let notified = false;
    const phone = doc.driver?.user?.phone;
    if (phone) {
      const docName = doc.documentType?.nameEn || 'document';
      const text =
        `PasarEx: your "${docName}" was not approved.\n` +
        `Reason: ${reason.trim()}\n` +
        `Please upload a corrected version in the app: ${env.api.publicBaseUrl}`;
      try {
        const res = await this.whatsapp.send(phone, text, doc.driver?.id);
        notified = res.status === 'sent';
      } catch {
        notified = false;
      }
    }
    this.realtime.emitOps('document.reviewed', { id: doc.id, status: doc.status });
    return { id: doc.id, status: doc.status, rejectionReason: doc.rejectionReason, whatsappNotified: notified };
  }
}
