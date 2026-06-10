// @sherpa/shared — types, enums and contracts shared by API + frontends.

// ── Roles & auth ────────────────────────────────────────────────
export enum Role {
  DRIVER = 'driver',
  DISPATCHER = 'dispatcher',
  SECURITY_OFFICER = 'security_officer',
  ADMIN = 'admin',
  CONSIGNEE = 'consignee', // link/OTP only, no full account
}

export interface JwtPayload {
  sub: string; // user id
  role: Role;
  email?: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

// ── Vehicles ────────────────────────────────────────────────────
export enum VehicleType {
  MOTO = 'moto',
  CARRO = 'carro',
  VAN = 'van',
  CAMIONETA = 'camioneta',
  BICI = 'bici',
}

export const VEHICLE_CAPACITY_KG: Record<VehicleType, number> = {
  [VehicleType.MOTO]: 15,
  [VehicleType.CARRO]: 80,
  [VehicleType.VAN]: 600,
  [VehicleType.CAMIONETA]: 1200,
  [VehicleType.BICI]: 8,
};

// ── Documents ───────────────────────────────────────────────────
export enum DocAppliesTo {
  DRIVER = 'driver',
  VEHICLE = 'vehicle',
}

export enum DocumentStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  EXPIRED = 'expired',
}

// ── Applications & approval workflow ────────────────────────────
export enum ApplicationStatus {
  DRAFT = 'draft',
  IN_REVIEW = 'in_review',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  RETURNED = 'returned',
}

export enum StageMode {
  MANUAL = 'manual',
  AUTOMATIC = 'automatic',
}

export enum TaskStatus {
  PENDING = 'pending',
  PASSED = 'passed',
  FAILED = 'failed',
  RETURNED = 'returned',
}

export enum ApprovalOutcome {
  PASS = 'pass',
  FAIL = 'fail',
  RETURN = 'return',
}

export enum SecurityCheckResult {
  PASS = 'pass',
  PENDING = 'pending',
  FLAG = 'flag',
  FAIL = 'fail',
}

// ── Driver status / eligibility ─────────────────────────────────
export enum DriverStatus {
  IDLE = 'idle',
  ENROUTE = 'enroute',
  DELIVERING = 'delivering',
  OFFDUTY = 'offduty',
}

// ── Freight / tenders / deliveries ──────────────────────────────
export enum FreightStatus {
  DRAFT = 'draft',
  AVAILABLE = 'available',
  BROADCASTING = 'broadcasting',
  ASSIGNED = 'assigned',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

export enum TenderResponseType {
  ACCEPT = 'accept',
  DECLINE = 'decline',
  EXPIRE = 'expire',
}

export enum DeliveryStatus {
  ASSIGNED = 'assigned',
  EN_ROUTE_PICKUP = 'en_route_pickup',
  PICKED_UP = 'picked_up',
  EN_ROUTE = 'en_route',
  DELIVERED = 'delivered',
  FAILED = 'failed',
}

// ── Scoring / tiers ─────────────────────────────────────────────
export enum DriverTier {
  ELITE = 'elite',
  PREFERENTE = 'preferente',
  ESTANDAR = 'estandar',
  NUEVO = 'nuevo',
}

export interface ScoringWeights {
  rating: number;
  completion: number;
  acceptance: number;
  onTime: number;
  recency: number;
}

export interface TierThreshold {
  tier: DriverTier;
  min: number;
}

// ── Notifications ───────────────────────────────────────────────
export enum NotificationChannel {
  PUSH = 'push',
  WHATSAPP = 'whatsapp',
  SMS = 'sms',
  IN_APP = 'in_app',
}

export type Locale = 'es' | 'en';

// ── Realtime (Socket.IO) event names ────────────────────────────
export const WS_EVENTS = {
  // server -> client
  APPLICATION_SUBMITTED: 'application.submitted',
  APPLICATION_DECIDED: 'application.decided',
  TENDER_OFFER: 'tender.offer',
  TENDER_RESOLVED: 'tender.resolved',
  DRIVER_LOCATION: 'driver.location',
  DELIVERY_UPDATED: 'delivery.updated',
  ELIGIBILITY_CHANGED: 'eligibility.changed',
  // client -> server
  LOCATION_PING: 'location.ping',
  JOIN: 'join',
} as const;

// ── Geo helpers ─────────────────────────────────────────────────
export interface LngLat {
  lng: number;
  lat: number;
}
