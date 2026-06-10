import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import * as argon2 from 'argon2';
import * as crypto from 'crypto';
import {
  ApplicationStatus,
  DocumentStatus,
  DocAppliesTo,
  Role,
  SecurityCheckResult,
  VEHICLE_CAPACITY_KG,
  VehicleType,
} from '@sherpa/shared';
import {
  Application,
  ApprovalWorkflow,
  AvailabilitySlot,
  Document,
  DocumentType,
  DriverProfile,
  OperatingArea,
  User,
  Vehicle,
} from '../database/entities';
import { StorageService } from '../storage/storage.service';
import { OcrService } from '../ocr/ocr.service';
import { AuditService } from '../audit/audit.service';

// top-level draft keys OCR is allowed to auto-fill (only when empty)
const AUTOFILL_KEYS = ['name', 'cedula', 'plate', 'brand', 'model', 'year', 'color'] as const;
// prototype day tokens -> JS weekday (0=Sun)
const WEEKDAY: Record<string, number> = { dom: 0, lun: 1, mar: 2, mie: 3, jue: 4, vie: 5, sab: 6 };

@Injectable()
export class OnboardingService {
  constructor(
    @InjectRepository(Application) private apps: Repository<Application>,
    @InjectRepository(DocumentType) private docTypes: Repository<DocumentType>,
    @InjectRepository(DriverProfile) private drivers: Repository<DriverProfile>,
    @InjectRepository(Vehicle) private vehicles: Repository<Vehicle>,
    @InjectRepository(Document) private documents: Repository<Document>,
    @InjectRepository(User) private users: Repository<User>,
    @InjectRepository(OperatingArea) private areas: Repository<OperatingArea>,
    @InjectRepository(AvailabilitySlot) private slots: Repository<AvailabilitySlot>,
    @InjectRepository(ApprovalWorkflow) private workflows: Repository<ApprovalWorkflow>,
    private storage: StorageService,
    private ocr: OcrService,
    private audit: AuditService,
  ) {}

  /** Active document types — the onboarding form renders from these (config-driven). */
  listDocumentTypes() {
    return this.docTypes.find({ where: { active: true }, order: { sortOrder: 'ASC' } });
  }

  /** Active operating areas — the zones step renders from these (config-driven). */
  async listOperatingAreas() {
    const list = await this.areas.find({ where: { active: true }, order: { nameEs: 'ASC' } });
    return list.map((a) => ({
      slug: a.slug,
      nameEs: a.nameEs,
      nameEn: a.nameEn,
      lng: a.centerLng,
      lat: a.centerLat,
    }));
  }

  async create() {
    const reference = await this.nextReference();
    const resumeToken = crypto.randomBytes(16).toString('hex');
    const app = await this.apps.save(
      this.apps.create({
        reference,
        resumeToken,
        status: ApplicationStatus.DRAFT,
        draft: { step: 0, docs: {}, documents: {}, zones: [], days: [], blocks: [] },
      }),
    );
    return { id: app.id, reference: app.reference, resumeToken };
  }

  private async load(id: string, token: string): Promise<Application> {
    const app = await this.apps.findOne({ where: { id } });
    if (!app) throw new NotFoundException('Application not found');
    if (app.status !== ApplicationStatus.DRAFT && app.status !== ApplicationStatus.RETURNED) {
      // resume only allowed while editable
      if (app.resumeToken !== token) throw new ForbiddenException();
      return app;
    }
    if (app.resumeToken !== token) throw new ForbiddenException('Invalid resume token');
    return app;
  }

  async get(id: string, token: string) {
    const app = await this.load(id, token);
    return this.publicView(app);
  }

  async updateDraft(id: string, token: string, patch: Record<string, any>) {
    const app = await this.load(id, token);
    app.draft = { ...app.draft, ...patch };
    await this.apps.save(app);
    return this.publicView(app);
  }

  /** Store an uploaded document, run OCR auto-fill, merge results into the draft. */
  async addDocument(
    id: string,
    token: string,
    docKey: string,
    file: { buffer: Buffer; originalname: string; mimetype: string },
  ) {
    const app = await this.load(id, token);
    const docType = await this.docTypes.findOne({ where: { key: docKey, active: true } });
    if (!docType) throw new BadRequestException(`Unknown document type: ${docKey}`);

    const stored = await this.storage.save(file.buffer, file.originalname, file.mimetype);
    const ocr = await this.ocr.extract(file.buffer, file.mimetype, docKey);

    const draft = { ...app.draft };
    draft.docs = { ...(draft.docs || {}), [docKey]: true };
    draft.documents = {
      ...(draft.documents || {}),
      [docKey]: { fileRef: stored.fileRef, mime: stored.mimeType, status: 'uploaded' },
    };

    // apply OCR results: fill empty top-level fields + record per-doc dates
    const applied: Record<string, string> = {};
    for (const k of AUTOFILL_KEYS) {
      if (ocr.fields[k] && !draft[k]) {
        draft[k] = ocr.fields[k];
        applied[k] = ocr.fields[k];
      }
    }
    if (ocr.fields.year && draft.vehicle === undefined) {
      // leave vehicle selection to the user
    }
    if (ocr.fields.expiryDate) {
      draft.docExpiry = { ...(draft.docExpiry || {}), [docKey]: ocr.fields.expiryDate };
      applied.expiryDate = ocr.fields.expiryDate;
    }
    if (ocr.fields.issueDate) {
      draft.docIssue = { ...(draft.docIssue || {}), [docKey]: ocr.fields.issueDate };
    }

    app.draft = draft;
    await this.apps.save(app);

    return {
      docKey,
      stored: { fileRef: stored.fileRef, size: stored.size },
      ocr: { ok: ocr.ok, skipped: ocr.skipped, reason: ocr.reason, fields: ocr.fields },
      applied,
      draft: this.publicView(app).draft,
    };
  }

  async submit(id: string, token: string, password?: string) {
    const app = await this.load(id, token);
    const draft = app.draft || {};

    // required-doc gate from config
    const required = await this.docTypes.find({ where: { required: true, active: true } });
    const missing = required.filter((dt) => !draft.docs?.[dt.key]).map((dt) => dt.key);
    if (missing.length) throw new BadRequestException(`Missing required documents: ${missing.join(', ')}`);
    if (!draft.vehicle) throw new BadRequestException('Vehicle type required');

    const workflow = await this.workflows.findOne({
      where: { active: true },
      relations: { stages: true },
    });
    const firstStage = workflow?.stages?.sort((a, b) => a.sortOrder - b.sortOrder)[0];

    // create the driver user + profile
    const email = draft.email || `${(draft.cedula || crypto.randomBytes(4).toString('hex'))}@driver.sherpa`;
    const passwordHash = await argon2.hash(password || crypto.randomBytes(12).toString('hex'));
    const user = await this.users.save(
      this.users.create({ email, phone: draft.phone, fullName: draft.name || 'Conductor', role: Role.DRIVER, passwordHash }),
    );

    const zoneAreas = draft.zones?.length
      ? await this.areas.find({ where: { slug: In(draft.zones) } })
      : [];

    const driver = await this.drivers.save(
      this.drivers.create({
        user,
        cedula: draft.cedula,
        securityCleared: false,
        eligible: false,
        operatingAreas: zoneAreas,
      }),
    );

    const vehicleType = draft.vehicle as VehicleType;
    await this.vehicles.save(
      this.vehicles.create({
        driver,
        type: vehicleType,
        plate: (draft.plate || '').toUpperCase(),
        brand: draft.brand,
        model: draft.model,
        year: draft.year ? parseInt(String(draft.year), 10) : undefined,
        color: draft.color,
        capacityKg: VEHICLE_CAPACITY_KG[vehicleType],
      }),
    );

    // availability slots
    const days: string[] = draft.days || [];
    const blocks: string[] = draft.blocks || [];
    const slotRows = days.flatMap((d) =>
      blocks.map((b) => this.slots.create({ driver, weekday: WEEKDAY[d] ?? 1, block: b })),
    );
    if (slotRows.length) await this.slots.save(slotRows);

    // document rows from the draft uploads
    const docRows: Document[] = [];
    for (const [key, info] of Object.entries<any>(draft.documents || {})) {
      const dt = required.find((r) => r.key === key) || (await this.docTypes.findOne({ where: { key } }));
      if (!dt) continue;
      docRows.push(
        this.documents.create({
          documentType: dt,
          driver,
          fileRef: info.fileRef,
          status: DocumentStatus.PENDING,
          expiryDate: draft.docExpiry?.[key],
          issueDate: draft.docIssue?.[key],
        }),
      );
    }
    if (docRows.length) await this.documents.save(docRows);

    // finalize application
    app.status = ApplicationStatus.IN_REVIEW;
    app.driver = driver;
    app.workflow = workflow ?? undefined;
    app.currentStage = firstStage ?? undefined;
    app.applicantName = draft.name;
    app.vehicleType = vehicleType;
    app.plate = (draft.plate || '').toUpperCase();
    app.zones = draft.zones || [];
    app.securityChecks = {
      identity: SecurityCheckResult.PENDING,
      criminal: SecurityCheckResult.PENDING,
      sanctions: SecurityCheckResult.PENDING,
      vehicle: SecurityCheckResult.PENDING,
    };
    await this.apps.save(app);

    await this.audit.log({
      action: 'application.submitted',
      entity: 'Application',
      entityId: app.id,
      after: { reference: app.reference, driverId: driver.id },
      reason: 'Applicant submitted onboarding',
    });

    return { id: app.id, reference: app.reference, status: app.status };
  }

  private publicView(app: Application) {
    return {
      id: app.id,
      reference: app.reference,
      status: app.status,
      draft: app.draft,
    };
  }

  private async nextReference(): Promise<string> {
    const count = await this.apps.count();
    let n = 7743 + count;
    // ensure uniqueness
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const ref = `AP-${n}`;
      const exists = await this.apps.findOne({ where: { reference: ref } });
      if (!exists) return ref;
      n++;
    }
  }
}
