import { DriverTier } from '@sherpa/shared';
import { computeScore, recencyScore, tierForScore } from './score';

const weights = { rating: 0.35, completion: 0.2, acceptance: 0.15, onTime: 0.2, recency: 0.1 };
const tiers = [
  { tier: DriverTier.ELITE, min: 92 },
  { tier: DriverTier.PREFERENTE, min: 80 },
  { tier: DriverTier.ESTANDAR, min: 60 },
  { tier: DriverTier.NUEVO, min: 0 },
];

describe('computeScore', () => {
  it('a perfect driver scores 100', () => {
    expect(computeScore({ avgRating: 5, completionRate: 100, acceptanceRate: 100, onTimeRate: 100, recencyScore: 100 }, weights)).toBe(100);
  });
  it('weights rating most heavily', () => {
    const lowRating = computeScore({ avgRating: 1, completionRate: 100, acceptanceRate: 100, onTimeRate: 100, recencyScore: 100 }, weights);
    const lowCompletion = computeScore({ avgRating: 5, completionRate: 30, acceptanceRate: 100, onTimeRate: 100, recencyScore: 100 }, weights);
    expect(lowRating).toBeLessThan(lowCompletion);
  });
  it('clamps out-of-range inputs', () => {
    expect(computeScore({ avgRating: 9, completionRate: 200, acceptanceRate: 100, onTimeRate: 100, recencyScore: 100 }, weights)).toBe(100);
  });
});

describe('tierForScore', () => {
  it('maps scores to configured tiers', () => {
    expect(tierForScore(96, tiers)).toBe(DriverTier.ELITE);
    expect(tierForScore(85, tiers)).toBe(DriverTier.PREFERENTE);
    expect(tierForScore(70, tiers)).toBe(DriverTier.ESTANDAR);
    expect(tierForScore(10, tiers)).toBe(DriverTier.NUEVO);
  });
});

describe('recencyScore', () => {
  it('is 100 for a delivery today and decays ~2/day', () => {
    const now = new Date('2026-06-10T12:00:00Z');
    expect(recencyScore(new Date('2026-06-10T12:00:00Z'), now)).toBe(100);
    expect(recencyScore(new Date('2026-06-05T12:00:00Z'), now)).toBe(90);
  });
  it('returns a neutral value for new drivers', () => {
    expect(recencyScore(null)).toBe(60);
  });
});
