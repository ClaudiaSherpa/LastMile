import { DriverTier, VehicleType } from '@sherpa/shared';

export interface FreightReq {
  requiredVehicle: VehicleType;
  weightKg: number;
  pickupZone: string;
  dropZone: string;
  priority: boolean;
}

export interface CandidateDriver {
  id: string;
  securityCleared: boolean;
  eligible: boolean;
  onDuty: boolean;
  status: string; // idle | enroute | delivering | offduty
  tier: DriverTier;
  score: number;
  onTimeRate: number;
  vehicleType?: VehicleType;
  capacityKg?: number;
  zones: string[];
}

export interface EligibilityFail {
  id: string;
  reason: string;
}

/**
 * The wave a driver first becomes eligible to accept in. Top tiers get an
 * exclusive early window before the offer widens. Priority freight is stricter:
 * only Elite drivers see wave 0.
 */
export function waveForDriver(tier: DriverTier, priority: boolean): number {
  if (priority) {
    return tier === DriverTier.ELITE ? 0 : tier === DriverTier.PREFERENTE ? 1 : tier === DriverTier.ESTANDAR ? 2 : 3;
  }
  switch (tier) {
    case DriverTier.ELITE:
    case DriverTier.PREFERENTE:
      return 0;
    case DriverTier.ESTANDAR:
      return 1;
    default:
      return 2;
  }
}

export const MAX_WAVE = 3;

function isAvailable(d: CandidateDriver): boolean {
  return d.onDuty && d.status !== 'delivering' && d.status !== 'offduty';
}

/** Why a single driver is/ineligible — handy for tests and Ops debugging. */
export function eligibilityReason(freight: FreightReq, d: CandidateDriver): string {
  if (!d.securityCleared) return 'not_security_cleared';
  if (!d.eligible) return 'suspended';
  if (!isAvailable(d)) return 'unavailable';
  if (d.vehicleType !== freight.requiredVehicle) return 'vehicle_type';
  if ((d.capacityKg ?? 0) < freight.weightKg) return 'capacity';
  if (!d.zones.includes(freight.pickupZone) && !d.zones.includes(freight.dropZone)) return 'out_of_area';
  return 'ok';
}

/**
 * Compute the eligible driver pool for a freight, ranked by DriverScore (desc),
 * each tagged with the broadcast wave it first becomes eligible in. Pure + tested.
 */
export function rankEligibleDrivers(
  freight: FreightReq,
  drivers: CandidateDriver[],
): Array<{ id: string; score: number; tier: DriverTier; wave: number }> {
  return drivers
    .filter((d) => eligibilityReason(freight, d) === 'ok')
    .sort((a, b) => b.score - a.score || b.onTimeRate - a.onTimeRate)
    .map((d) => ({ id: d.id, score: d.score, tier: d.tier, wave: waveForDriver(d.tier, freight.priority) }));
}

/** Driver ids that should be offered the tender at (or below) the current wave. */
export function driversForWave(
  ranked: Array<{ id: string; wave: number }>,
  currentWave: number,
): string[] {
  return ranked.filter((d) => d.wave <= currentWave).map((d) => d.id);
}
