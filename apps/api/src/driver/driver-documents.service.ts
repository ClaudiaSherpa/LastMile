import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DocumentStatus } from '@sherpa/shared';
import { Document, DocumentType, DriverProfile } from '../database/entities';
import { StorageService } from '../storage/storage.service';
import { OcrService } from '../ocr/ocr.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';

@Injectable()
export class DriverDocumentsService {
  constructor(
    @InjectRepository(Document) private documents: Repository<Document>,
    @InjectRepository(DocumentType) private docTypes: Repository<DocumentType>,
    @InjectRepository(DriverProfile) private drivers: Repository<DriverProfile>,
    private storage: StorageService,
    private ocr: OcrService,
    private realtime: RealtimeGateway,
  ) {}

  /** The driver's document checklist: every active type + their current upload (if any). */
  async list(driverId: string) {
    const [types, docs] = await Promise.all([
      this.docTypes.find({ where: { active: true }, order: { sortOrder: 'ASC' } }),
      this.documents.find({ where: { driver: { id: driverId } }, order: { createdAt: 'DESC' } }),
    ]);
    // latest document per type key
    const latest = new Map<string, Document>();
    for (const d of docs) {
      const key = d.documentType?.key;
      if (key && !latest.has(key)) latest.set(key, d);
    }
    return types.map((tp) => {
      const d = latest.get(tp.key);
      return {
        key: tp.key,
        name: tp.nameEn,
        nameEs: tp.nameEs,
        required: tp.required,
        tracksExpiry: tp.tracksExpiry,
        documentId: d?.id ?? null,
        status: d?.status ?? null,
        expiryDate: d?.expiryDate ?? null,
        issueDate: d?.issueDate ?? null,
        rejectionReason: d?.rejectionReason ?? null,
        hasFile: !!d?.fileRef,
      };
    });
  }

  /** Upload (or replace) a document for the signed-in driver; resets it to PENDING review. */
  async upload(
    driverId: string,
    docKey: string,
    file: { buffer: Buffer; originalname: string; mimetype: string },
    dates?: { issueDate?: string; expiryDate?: string },
  ) {
    if (!file) throw new BadRequestException('file is required');
    if (!docKey) throw new BadRequestException('docKey is required');
    const docType = await this.docTypes.findOne({ where: { key: docKey, active: true } });
    if (!docType) throw new BadRequestException(`Unknown document type: ${docKey}`);
    const driver = await this.drivers.findOne({ where: { id: driverId }, relations: { user: true } });
    if (!driver) throw new NotFoundException('Driver not found');

    const stored = await this.storage.save(file.buffer, file.originalname, file.mimetype);

    // fill expiry/issue from the client, else try OCR (degrades gracefully with no key)
    let expiryDate = dates?.expiryDate || undefined;
    let issueDate = dates?.issueDate || undefined;
    if (!expiryDate || !issueDate) {
      const ocr = await this.ocr.extract(file.buffer, file.mimetype, docKey);
      if (!expiryDate && ocr.fields.expiryDate) expiryDate = ocr.fields.expiryDate;
      if (!issueDate && ocr.fields.issueDate) issueDate = ocr.fields.issueDate;
    }

    // replace the driver's latest doc of this type, else create a new one
    let doc = await this.documents.findOne({
      where: { driver: { id: driverId }, documentType: { id: docType.id } },
      order: { createdAt: 'DESC' },
    });
    if (doc) {
      doc.fileRef = stored.fileRef;
      doc.status = DocumentStatus.PENDING;
      doc.rejectionReason = undefined;
      if (expiryDate) doc.expiryDate = expiryDate;
      if (issueDate) doc.issueDate = issueDate;
    } else {
      doc = this.documents.create({
        driver,
        documentType: docType,
        fileRef: stored.fileRef,
        status: DocumentStatus.PENDING,
        expiryDate,
        issueDate,
      });
    }
    await this.documents.save(doc);
    // notify Ops (security/admin) that a document is awaiting review
    this.realtime.emitOps('document.pending', { driverId, driverName: driver.user?.fullName, docKey, docName: docType.nameEn });
    return {
      documentId: doc.id,
      key: docKey,
      status: doc.status,
      expiryDate: doc.expiryDate ?? null,
      issueDate: doc.issueDate ?? null,
      hasFile: true,
    };
  }

  /** Read a document's file — only if it belongs to this driver. */
  async fileFor(driverId: string, documentId: string): Promise<{ buffer: Buffer; fileRef: string }> {
    const doc = await this.documents.findOne({
      where: { id: documentId, driver: { id: driverId } },
    });
    if (!doc || !doc.fileRef) throw new NotFoundException('Document file not found');
    try {
      return { buffer: this.storage.read(doc.fileRef), fileRef: doc.fileRef };
    } catch {
      throw new NotFoundException('File missing from storage');
    }
  }
}
