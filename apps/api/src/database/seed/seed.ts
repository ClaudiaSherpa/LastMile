import 'reflect-metadata';
import * as argon2 from 'argon2';
import {
  DocAppliesTo,
  DriverStatus,
  DriverTier,
  NotificationChannel,
  Role,
  SecurityCheckResult,
  StageMode,
  VEHICLE_CAPACITY_KG,
  VehicleType,
  ApplicationStatus,
  DocumentStatus,
} from '@sherpa/shared';
import { AppDataSource } from '../data-source';
import {
  ApprovalStage,
  ApprovalWorkflow,
  Application,
  AvailabilitySlot,
  Document,
  DocumentType,
  DriverProfile,
  NotificationTemplate,
  OperatingArea,
  ScoringConfig,
  User,
  Vehicle,
} from '../entities';
import { ZONES, boxPolygon, zoneBySlug } from './barbados';

const TIERS = [
  { tier: DriverTier.ELITE, min: 92 },
  { tier: DriverTier.PREFERENTE, min: 80 },
  { tier: DriverTier.ESTANDAR, min: 60 },
  { tier: DriverTier.NUEVO, min: 0 },
];
const tierFor = (s: number) => TIERS.find((t) => s >= t.min)!.tier;

async function run() {
  const ds = await AppDataSource.initialize();
  console.log('▶ seeding PasarEx LM …');

  // wipe (idempotent reseed) — order respects FKs
  await ds.query(`
    TRUNCATE TABLE
      ratings, location_pings, deliveries, tender_responses, tenders, freights,
      approval_tasks, applications, approval_stages, approval_workflows,
      documents, availability_slots, driver_operating_areas, vehicles, driver_profiles,
      operating_areas, document_types, scoring_configs, notification_templates,
      reminders, notifications, audit_logs, users
    RESTART IDENTITY CASCADE;
  `);

  // ── DocumentTypes (CONFIG) ───────────────────────────────────
  const docTypeRepo = ds.getRepository(DocumentType);
  const docTypes = await docTypeRepo.save([
    docTypeRepo.create({ key: 'license', nameEs: "Driver's licence", nameEn: "Driver's licence", appliesTo: DocAppliesTo.DRIVER, required: true, tracksExpiry: true, reminderOffsets: [30, 15, 3], sortOrder: 1 }),
    docTypeRepo.create({ key: 'soat', nameEs: 'Compulsory vehicle insurance', nameEn: 'Compulsory vehicle insurance', appliesTo: DocAppliesTo.VEHICLE, required: true, tracksExpiry: true, reminderOffsets: [30, 15, 3], sortOrder: 2 }),
    docTypeRepo.create({ key: 'insurance', nameEs: 'Comprehensive cover (optional)', nameEn: 'Comprehensive cover (optional)', appliesTo: DocAppliesTo.VEHICLE, required: false, tracksExpiry: true, reminderOffsets: [30, 15], sortOrder: 3 }),
    docTypeRepo.create({ key: 'property', nameEs: 'Vehicle registration', nameEn: 'Vehicle registration', appliesTo: DocAppliesTo.VEHICLE, required: true, tracksExpiry: false, sortOrder: 4 }),
    docTypeRepo.create({ key: 'id', nameEs: 'National ID + selfie', nameEn: 'National ID + selfie', appliesTo: DocAppliesTo.DRIVER, required: true, tracksExpiry: false, sortOrder: 5 }),
  ]);
  console.log(`  ✓ ${docTypes.length} document types`);

  // ── OperatingAreas (PostGIS polygons) ────────────────────────
  const areaRepo = ds.getRepository(OperatingArea);
  const areas = await areaRepo.save(
    ZONES.map((z) =>
      areaRepo.create({
        slug: z.slug,
        nameEs: z.nameEs,
        nameEn: z.nameEn,
        area: boxPolygon(z.lng, z.lat),
        centerLng: z.lng,
        centerLat: z.lat,
      }),
    ),
  );
  const areaBySlug = (slug: string) => areas.find((a) => a.slug === slug)!;
  console.log(`  ✓ ${areas.length} operating areas`);

  // ── Approval workflow (CONFIG) with mandatory security stage ──
  const wfRepo = ds.getRepository(ApprovalWorkflow);
  const stageRepo = ds.getRepository(ApprovalStage);
  const workflow = await wfRepo.save(wfRepo.create({ name: 'Onboarding estándar', active: true }));
  const stages = await stageRepo.save([
    stageRepo.create({ workflow, nameEs: 'Validación de documentos', nameEn: 'Document validation', sortOrder: 1, mode: StageMode.AUTOMATIC, responsibleRole: Role.DISPATCHER, requiredDocs: ['license', 'soat', 'property', 'id'], ruleset: { requireAllRequiredDocs: true }, slaHours: 4 }),
    stageRepo.create({ workflow, nameEs: 'Verificación de seguridad', nameEn: 'Security clearance', sortOrder: 2, mode: StageMode.MANUAL, responsibleRole: Role.SECURITY_OFFICER, isSecurityClearance: true, slaHours: 48 }),
    stageRepo.create({ workflow, nameEs: 'Aprobación final', nameEn: 'Final approval', sortOrder: 3, mode: StageMode.MANUAL, responsibleRole: Role.DISPATCHER, slaHours: 24 }),
  ]);
  console.log(`  ✓ workflow with ${stages.length} stages (security gate included)`);

  // ── Scoring config (CONFIG) ──────────────────────────────────
  const scoringRepo = ds.getRepository(ScoringConfig);
  await scoringRepo.save(
    scoringRepo.create({
      name: 'default',
      active: true,
      weights: { rating: 0.35, completion: 0.2, acceptance: 0.15, onTime: 0.2, recency: 0.1 },
      tiers: TIERS,
    }),
  );
  console.log('  ✓ scoring config');

  // ── Notification templates (CONFIG, ES+EN) ───────────────────
  const tplRepo = ds.getRepository(NotificationTemplate);
  const T = (key: string, channel: NotificationChannel, es: string, en: string) => [
    tplRepo.create({ key, channel, locale: 'es', body: es }),
    tplRepo.create({ key, channel, locale: 'en', body: en }),
  ];
  await tplRepo.save([
    ...T('application.approved', NotificationChannel.PUSH, '¡Felicidades {{name}}! Tu solicitud fue aprobada. Ya puedes recibir fletes.', 'Congrats {{name}}! Your application was approved. You can now receive freight.'),
    ...T('application.rejected', NotificationChannel.PUSH, 'Tu solicitud fue rechazada. Motivo: {{reason}}.', 'Your application was rejected. Reason: {{reason}}.'),
    ...T('doc.expiring', NotificationChannel.WHATSAPP, 'Hola {{name}}, tu {{doc}} vence en {{days}} días. Renuévalo para seguir recibiendo fletes.', 'Hi {{name}}, your {{doc}} expires in {{days}} days. Renew it to keep receiving freight.'),
    ...T('doc.expired', NotificationChannel.WHATSAPP, '{{name}}, tu {{doc}} venció. Tu elegibilidad quedó suspendida hasta renovarlo.', '{{name}}, your {{doc}} expired. Your eligibility is suspended until you renew it.'),
    ...T('tender.offer', NotificationChannel.PUSH, 'Nuevo flete {{ref}} disponible · {{payout}}. ¡Acepta ya!', 'New freight {{ref}} available · {{payout}}. Accept now!'),
    ...T('rating.request', NotificationChannel.WHATSAPP, 'Tu pedido fue entregado. Califica a {{driver}} aquí: {{link}}', 'Your order was delivered. Rate {{driver}} here: {{link}}'),
  ]);
  console.log('  ✓ notification templates');

  // ── Staff users ──────────────────────────────────────────────
  const userRepo = ds.getRepository(User);
  const pw = await argon2.hash('pasarex123');
  await userRepo.save([
    userRepo.create({ email: 'admin@pasarex.com', fullName: 'PasarEx Admin', role: Role.ADMIN, passwordHash: pw }),
    userRepo.create({ email: 'dispatch@pasarex.com', fullName: 'Bridgetown Dispatch', role: Role.DISPATCHER, passwordHash: pw }),
    userRepo.create({ email: 'security@pasarex.com', fullName: 'Security Officer', role: Role.SECURITY_OFFICER, passwordHash: pw }),
  ]);
  console.log('  ✓ staff users (admin/dispatch/security)');

  // ── Active drivers (mirror the prototype seed) ───────────────
  const driverRepo = ds.getRepository(DriverProfile);
  const vehicleRepo = ds.getRepository(Vehicle);
  const slotRepo = ds.getRepository(AvailabilitySlot);
  const profilesByEmail: Record<string, DriverProfile> = {};

  const activeDrivers = [
    { name: 'Andre Griffith', email: 'andre@drv.co', vehicle: VehicleType.MOTO, plate: 'P 4821', score: 96, zone: 'st_michael', zones: ['st_michael', 'st_george', 'christ_church'], status: DriverStatus.IDLE, deliveries: 1284, accept: 98, onTime: 99, rating: 4.9 },
    { name: 'Shanice Boyce', email: 'shanice@drv.co', vehicle: VehicleType.CARRO, plate: 'H 2093', score: 88, zone: 'christ_church', zones: ['christ_church', 'st_michael', 'st_philip'], status: DriverStatus.DELIVERING, deliveries: 642, accept: 91, onTime: 94, rating: 4.6 },
    { name: 'Rohan Clarke', email: 'rohan@drv.co', vehicle: VehicleType.VAN, plate: 'B 1147', score: 83, zone: 'st_philip', zones: ['st_philip', 'st_john', 'st_george'], status: DriverStatus.IDLE, deliveries: 410, accept: 86, onTime: 89, rating: 4.4 },
    { name: 'Kimberly Weekes', email: 'kimberly@drv.co', vehicle: VehicleType.MOTO, plate: 'P 7758', score: 74, zone: 'st_peter', zones: ['st_peter', 'st_lucy', 'st_andrew'], status: DriverStatus.IDLE, deliveries: 188, accept: 79, onTime: 85, rating: 4.1 },
    { name: 'Marcus Belgrave', email: 'marcus@drv.co', vehicle: VehicleType.CAMIONETA, plate: 'P 3310', score: 91, zone: 'st_thomas', zones: ['st_thomas', 'st_james', 'st_michael'], status: DriverStatus.IDLE, deliveries: 523, accept: 93, onTime: 96, rating: 4.7 },
  ];

  for (const d of activeDrivers) {
    const z = zoneBySlug(d.zone)!;
    const user = await userRepo.save(userRepo.create({ email: d.email, fullName: d.name, role: Role.DRIVER, passwordHash: pw }));
    const profile = await driverRepo.save(
      driverRepo.create({
        user,
        cedula: '10' + Math.floor(Math.random() * 9_000_000 + 1_000_000),
        status: d.status,
        onDuty: d.status !== DriverStatus.OFFDUTY,
        securityCleared: true,
        eligible: true,
        score: d.score,
        tier: tierFor(d.score),
        deliveriesCount: d.deliveries,
        acceptanceRate: d.accept,
        onTimeRate: d.onTime,
        completionRate: 100,
        avgRating: d.rating,
        lastLng: z.lng,
        lastLat: z.lat,
        operatingAreas: d.zones.map((s) => areaBySlug(s)),
      }),
    );
    await vehicleRepo.save(
      vehicleRepo.create({ driver: profile, type: d.vehicle, plate: d.plate, brand: 'Genérico', year: 2021, capacityKg: VEHICLE_CAPACITY_KG[d.vehicle] }),
    );
    // Mon–Fri mornings + afternoons
    await slotRepo.save(
      [1, 2, 3, 4, 5].flatMap((wd) =>
        ['manana', 'tarde'].map((block) => slotRepo.create({ driver: profile, weekday: wd, block })),
      ),
    );
    profilesByEmail[d.email] = profile;
  }
  console.log(`  ✓ ${activeDrivers.length} active drivers + vehicles + availability`);

  // ── Tracked documents w/ expiries (drive the compliance demo) ──
  const docRepo = ds.getRepository(Document);
  const dt = (key: string) => docTypes.find((x) => x.key === key)!;
  const isoIn = (days: number) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
  };
  await docRepo.save([
    // Shanice: insurance expiring soon (reminder demo) + licence further out
    docRepo.create({ driver: profilesByEmail['shanice@drv.co'], documentType: dt('soat'), status: DocumentStatus.APPROVED, expiryDate: isoIn(10) }),
    docRepo.create({ driver: profilesByEmail['shanice@drv.co'], documentType: dt('license'), status: DocumentStatus.APPROVED, expiryDate: isoIn(40) }),
    // Kimberly: already-lapsed required insurance — a scan will expire it and auto-suspend her
    docRepo.create({ driver: profilesByEmail['kimberly@drv.co'], documentType: dt('soat'), status: DocumentStatus.APPROVED, expiryDate: isoIn(-5) }),
    docRepo.create({ driver: profilesByEmail['kimberly@drv.co'], documentType: dt('license'), status: DocumentStatus.APPROVED, expiryDate: isoIn(120) }),
  ]);
  console.log('  ✓ tracked documents with expiries (compliance demo)');

  // ── Pending applications (Ops security queue) ────────────────
  const appRepo = ds.getRepository(Application);
  const pending = [
    { ref: 'AP-7741', name: 'Latoya Holder', vehicle: VehicleType.MOTO, plate: 'P 5521', zones: ['st_peter', 'st_lucy'], checks: { identity: SecurityCheckResult.PASS, criminal: SecurityCheckResult.PENDING, sanctions: SecurityCheckResult.PASS, vehicle: SecurityCheckResult.PASS } },
    { ref: 'AP-7742', name: 'Devon Gittens', vehicle: VehicleType.CAMIONETA, plate: 'P 1180', zones: ['st_philip', 'st_john', 'st_george'], checks: { identity: SecurityCheckResult.PASS, criminal: SecurityCheckResult.PASS, sanctions: SecurityCheckResult.FLAG, vehicle: SecurityCheckResult.PASS } },
    { ref: 'AP-7740', name: 'Alisha Blackman', vehicle: VehicleType.CARRO, plate: 'H 7402', zones: ['st_michael', 'christ_church'], checks: { identity: SecurityCheckResult.PASS, criminal: SecurityCheckResult.PASS, sanctions: SecurityCheckResult.PASS, vehicle: SecurityCheckResult.PENDING } },
  ];
  for (const a of pending) {
    await appRepo.save(
      appRepo.create({
        reference: a.ref,
        workflow,
        status: ApplicationStatus.IN_REVIEW,
        applicantName: a.name,
        vehicleType: a.vehicle,
        plate: a.plate,
        zones: a.zones,
        securityChecks: a.checks,
        currentStage: stages[1], // sitting at the security stage
        draft: { name: a.name, vehicle: a.vehicle, plate: a.plate, zones: a.zones },
      }),
    );
  }
  console.log(`  ✓ ${pending.length} pending applications in the security queue`);

  await ds.destroy();
  console.log('✅ seed complete — login with admin@pasarex.com / pasarex123');
}

run().catch((e) => {
  console.error('seed failed:', e);
  process.exit(1);
});
