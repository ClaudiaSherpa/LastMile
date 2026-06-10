import { DriverTier, VehicleType } from '@sherpa/shared';
import {
  CandidateDriver,
  driversForWave,
  eligibilityReason,
  rankEligibleDrivers,
  waveForDriver,
} from './pool';

const base = (over: Partial<CandidateDriver> = {}): CandidateDriver => ({
  id: 'd1',
  securityCleared: true,
  eligible: true,
  onDuty: true,
  status: 'idle',
  tier: DriverTier.ESTANDAR,
  score: 70,
  onTimeRate: 90,
  vehicleType: VehicleType.MOTO,
  capacityKg: 15,
  zones: ['chico', 'usaquen'],
  ...over,
});

const freight = {
  requiredVehicle: VehicleType.MOTO,
  weightKg: 6,
  pickupZone: 'chico',
  dropZone: 'usaquen',
  priority: false,
};

describe('eligibilityReason', () => {
  it('passes a fully-qualified driver', () => {
    expect(eligibilityReason(freight, base())).toBe('ok');
  });
  it('rejects not security-cleared', () => {
    expect(eligibilityReason(freight, base({ securityCleared: false }))).toBe('not_security_cleared');
  });
  it('rejects suspended (ineligible)', () => {
    expect(eligibilityReason(freight, base({ eligible: false }))).toBe('suspended');
  });
  it('rejects delivering/offduty as unavailable', () => {
    expect(eligibilityReason(freight, base({ status: 'delivering' }))).toBe('unavailable');
    expect(eligibilityReason(freight, base({ onDuty: false, status: 'offduty' }))).toBe('unavailable');
  });
  it('rejects wrong vehicle type', () => {
    expect(eligibilityReason(freight, base({ vehicleType: VehicleType.VAN }))).toBe('vehicle_type');
  });
  it('rejects insufficient capacity', () => {
    expect(eligibilityReason({ ...freight, weightKg: 100 }, base())).toBe('capacity');
  });
  it('rejects out-of-area drivers', () => {
    expect(eligibilityReason(freight, base({ zones: ['bosa'] }))).toBe('out_of_area');
  });
});

describe('rankEligibleDrivers', () => {
  it('filters ineligible and sorts by score desc', () => {
    const ranked = rankEligibleDrivers(freight, [
      base({ id: 'a', score: 80 }),
      base({ id: 'b', score: 95 }),
      base({ id: 'c', score: 60, eligible: false }), // suspended -> filtered
      base({ id: 'd', score: 70 }),
    ]);
    expect(ranked.map((r) => r.id)).toEqual(['b', 'a', 'd']);
  });
});

describe('waves', () => {
  it('elite/preferred start in wave 0, standard wave 1, new wave 2', () => {
    expect(waveForDriver(DriverTier.ELITE, false)).toBe(0);
    expect(waveForDriver(DriverTier.PREFERENTE, false)).toBe(0);
    expect(waveForDriver(DriverTier.ESTANDAR, false)).toBe(1);
    expect(waveForDriver(DriverTier.NUEVO, false)).toBe(2);
  });
  it('priority freight is elite-exclusive in wave 0', () => {
    expect(waveForDriver(DriverTier.ELITE, true)).toBe(0);
    expect(waveForDriver(DriverTier.PREFERENTE, true)).toBe(1);
  });
  it('driversForWave widens the pool as the wave advances', () => {
    const ranked = [
      { id: 'elite', wave: 0 },
      { id: 'std', wave: 1 },
      { id: 'new', wave: 2 },
    ];
    expect(driversForWave(ranked, 0)).toEqual(['elite']);
    expect(driversForWave(ranked, 1)).toEqual(['elite', 'std']);
    expect(driversForWave(ranked, 2)).toEqual(['elite', 'std', 'new']);
  });
});
