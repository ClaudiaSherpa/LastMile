import { DriverTier, ScoringWeights, TierThreshold } from '@sherpa/shared';

export interface ScoreMetrics {
  avgRating: number; // 0..5
  completionRate: number; // 0..100
  acceptanceRate: number; // 0..100
  onTimeRate: number; // 0..100
  recencyScore: number; // 0..100
}

const clamp = (n: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n));

/**
 * DriverScore = configurable weighted blend of (normalized) rating, completion,
 * acceptance, on-time and recency. Pure + unit-tested. Weights come from the
 * active ScoringConfig; rating is normalized from 0..5 to 0..100.
 */
export function computeScore(m: ScoreMetrics, w: ScoringWeights): number {
  const ratingComponent = (clamp(m.avgRating, 0, 5) / 5) * 100;
  const raw =
    ratingComponent * w.rating +
    clamp(m.completionRate) * w.completion +
    clamp(m.acceptanceRate) * w.acceptance +
    clamp(m.onTimeRate) * w.onTime +
    clamp(m.recencyScore) * w.recency;
  return Math.round(clamp(raw) * 10) / 10;
}

/** Map a score to a tier using the configured thresholds (descending by `min`). */
export function tierForScore(score: number, thresholds: TierThreshold[]): DriverTier {
  const sorted = [...thresholds].sort((a, b) => b.min - a.min);
  for (const th of sorted) if (score >= th.min) return th.tier;
  return sorted[sorted.length - 1]?.tier ?? DriverTier.NUEVO;
}

/** Recency decays ~2 pts/day since the last completed delivery (100 if today). */
export function recencyScore(lastDeliveryAt: Date | null, now: Date = new Date()): number {
  if (!lastDeliveryAt) return 60; // brand-new driver — neutral-ish
  const days = Math.max(0, (now.getTime() - lastDeliveryAt.getTime()) / 86_400_000);
  return clamp(100 - days * 2);
}
