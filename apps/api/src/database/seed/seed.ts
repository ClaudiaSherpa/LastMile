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
  FreightStatus,
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
  Freight,
  NotificationTemplate,
  OperatingArea,
  ScoringConfig,
  User,
  Vehicle,
} from '../entities';
import { ZONES, boxPolygon, point, zoneBySlug } from './bogota';

const TIERS = [
  { tier: DriverTier.ELITE, min: 92 },
  { tier: DriverTier.PREFERENTE, min: 80 },
  { tier: DriverTier.ESTANDAR, min: 60 },
  { tier: DriverTier.NUEVO, min: 0 },
];
const tierFor = (s: number) => TIERS.find((t) => s >= t.min)!.tier;

async function run() {
  const ds = await AppDataSource.initialize();
  console.log('▶ seeding Sherpa LM …');

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
    docTypeRepo.create({ key: 'license', nameEs: 'Licencia de conducción', nameEn: "Driver's license", appliesTo: DocAppliesTo.DRIVER, required: true, tracksExpiry: true, reminderOffsets: [30, 15, 3], sortOrder: 1 }),
    docTypeRepo.create({ key: 'soat', nameEs: 'SOAT vigente', nameEn: 'SOAT (mandatory insurance)', appliesTo: DocAppliesTo.VEHICLE, required: true, tracksExpiry: true, reminderOffsets: [30, 15, 3], sortOrder: 2 }),
    docTypeRepo.create({ key: 'insurance', nameEs: 'Póliza todo riesgo', nameEn: 'All-risk policy', appliesTo: DocAppliesTo.VEHICLE, required: false, tracksExpiry: true, reminderOffsets: [30, 15], sortOrder: 3 }),
    docTypeRepo.create({ key: 'property', nameEs: 'Tarjeta de propiedad', nameEn: 'Vehicle registration', appliesTo: DocAppliesTo.VEHICLE, required: true, tracksExpiry: false, sortOrder: 4 }),
    docTypeRepo.create({ key: 'id', nameEs: 'Cédula + selfie', nameEn: 'ID + selfie', appliesTo: DocAppliesTo.DRIVER, required: true, tracksExpiry: false, sortOrder: 5 }),
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
  const pw = await argon2.hash('sherpa123');
  await userRepo.save([
    userRepo.create({ email: 'admin@sherpa-c.com', fullName: 'Admin Sherpa', role: Role.ADMIN, passwordHash: pw }),
    userRepo.create({ email: 'dispatch@sherpa-c.com', fullName: 'Despacho Bogotá', role: Role.DISPATCHER, passwordHash: pw }),
    userRepo.create({ email: 'security@sherpa-c.com', fullName: 'Oficial de Seguridad', role: Role.SECURITY_OFFICER, passwordHash: pw }),
  ]);
  console.log('  ✓ staff users (admin/dispatch/security)');

  // ── Active drivers (mirror the prototype seed) ───────────────
  const driverRepo = ds.getRepository(DriverProfile);
  const vehicleRepo = ds.getRepository(Vehicle);
  const slotRepo = ds.getRepository(AvailabilitySlot);
  const profilesByEmail: Record<string, DriverProfile> = {};

  const activeDrivers = [
    { name: 'Aurelio Quintero', email: 'aurelio@drv.co', vehicle: VehicleType.MOTO, plate: 'KXR-21F', score: 96, zone: 'chapinero', zones: ['chapinero', 'chico', 'usaquen'], status: DriverStatus.IDLE, deliveries: 1284, accept: 98, onTime: 99, rating: 4.9 },
    { name: 'Marisol Vega', email: 'marisol@drv.co', vehicle: VehicleType.CARRO, plate: 'GHT-845', score: 88, zone: 'teusaquillo', zones: ['teusaquillo', 'centro', 'kennedy'], status: DriverStatus.DELIVERING, deliveries: 642, accept: 91, onTime: 94, rating: 4.6 },
    { name: 'Bernardo Ruiz', email: 'bernardo@drv.co', vehicle: VehicleType.VAN, plate: 'WPL-302', score: 83, zone: 'kennedy', zones: ['kennedy', 'fontibon', 'bosa'], status: DriverStatus.IDLE, deliveries: 410, accept: 86, onTime: 89, rating: 4.4 },
    { name: 'Camila Ardila', email: 'camila@drv.co', vehicle: VehicleType.MOTO, plate: 'JDR-77E', score: 74, zone: 'suba', zones: ['suba', 'engativa'], status: DriverStatus.IDLE, deliveries: 188, accept: 79, onTime: 85, rating: 4.1 },
    { name: 'Héctor Paz', email: 'hector@drv.co', vehicle: VehicleType.CAMIONETA, plate: 'TBN-019', score: 91, zone: 'usaquen', zones: ['usaquen', 'chico'], status: DriverStatus.IDLE, deliveries: 523, accept: 93, onTime: 96, rating: 4.7 },
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
    // Marisol: SOAT expiring soon (reminder demo) + license further out
    docRepo.create({ driver: profilesByEmail['marisol@drv.co'], documentType: dt('soat'), status: DocumentStatus.APPROVED, expiryDate: isoIn(10) }),
    docRepo.create({ driver: profilesByEmail['marisol@drv.co'], documentType: dt('license'), status: DocumentStatus.APPROVED, expiryDate: isoIn(40) }),
    // Camila: already-lapsed required SOAT — a scan will expire it and auto-suspend her
    docRepo.create({ driver: profilesByEmail['camila@drv.co'], documentType: dt('soat'), status: DocumentStatus.APPROVED, expiryDate: isoIn(-5) }),
    docRepo.create({ driver: profilesByEmail['camila@drv.co'], documentType: dt('license'), status: DocumentStatus.APPROVED, expiryDate: isoIn(120) }),
  ]);
  console.log('  ✓ tracked documents with expiries (compliance demo)');

  // ── Pending applications (Ops security queue) ────────────────
  const appRepo = ds.getRepository(Application);
  const pending = [
    { ref: 'AP-7741', name: 'Lucía Granados', vehicle: VehicleType.MOTO, plate: 'FNK-552', zones: ['suba', 'engativa'], checks: { identity: SecurityCheckResult.PASS, criminal: SecurityCheckResult.PENDING, sanctions: SecurityCheckResult.PASS, vehicle: SecurityCheckResult.PASS } },
    { ref: 'AP-7742', name: 'Óscar Beltrán', vehicle: VehicleType.CAMIONETA, plate: 'RQS-118', zones: ['kennedy', 'bosa', 'fontibon'], checks: { identity: SecurityCheckResult.PASS, criminal: SecurityCheckResult.PASS, sanctions: SecurityCheckResult.FLAG, vehicle: SecurityCheckResult.PASS } },
    { ref: 'AP-7740', name: 'Daniela Forero', vehicle: VehicleType.CARRO, plate: 'MZP-740', zones: ['chapinero', 'chico'], checks: { identity: SecurityCheckResult.PASS, criminal: SecurityCheckResult.PASS, sanctions: SecurityCheckResult.PASS, vehicle: SecurityCheckResult.PENDING } },
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

  // ── Sample freight ───────────────────────────────────────────
  const freightRepo = ds.getRepository(Freight);
  let seq = 4820;
  const freights = [
    { client: 'Farmadrid', pickup: 'chico', drop: 'usaquen', vehicle: VehicleType.MOTO, weight: 6, payout: 18400, distance: 4.2, window: 30, priority: true },
    { client: 'Mercaldas', pickup: 'teusaquillo', drop: 'kennedy', vehicle: VehicleType.CARRO, weight: 32, payout: 29900, distance: 9.1, window: 60, priority: false },
    { client: 'Corabastos Pro', pickup: 'fontibon', drop: 'bosa', vehicle: VehicleType.VAN, weight: 210, payout: 74500, distance: 12.7, window: 120, priority: false },
  ];
  for (const f of freights) {
    const p = zoneBySlug(f.pickup)!;
    const dz = zoneBySlug(f.drop)!;
    await freightRepo.save(
      freightRepo.create({
        reference: 'F-' + seq++,
        client: f.client,
        consigneeName: 'Cliente ' + f.client,
        consigneePhone: '+57 30' + Math.floor(Math.random() * 90000000 + 10000000),
        pickupZone: f.pickup,
        dropZone: f.drop,
        pickupPoint: point(p.lng, p.lat),
        dropPoint: point(dz.lng, dz.lat),
        requiredVehicle: f.vehicle,
        weightKg: f.weight,
        windowMinutes: f.window,
        distanceKm: f.distance,
        payout: f.payout,
        priority: f.priority,
        status: FreightStatus.AVAILABLE,
      }),
    );
  }
  console.log(`  ✓ ${freights.length} sample freights`);

  await ds.destroy();
  console.log('✅ seed complete — login with admin@sherpa-c.com / sherpa123');
}

run().catch((e) => {
  console.error('seed failed:', e);
  process.exit(1);
});
