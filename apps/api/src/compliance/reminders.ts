/** Whole days from `now` until `expiry` (negative once expired). */
export function daysUntil(expiry: string | Date, now: Date = new Date()): number {
  const e = new Date(expiry).getTime();
  const ms = e - now.getTime();
  return Math.floor(ms / 86_400_000);
}

export interface ReminderDecision {
  /** the offset to actually send a reminder for, or null */
  fire: number | null;
  /** offsets to mark as handled (the fired one + any stale earlier thresholds) */
  markSent: number[];
}

/**
 * Decide which reminder offset (e.g. 30/15/3 days before expiry) should fire on
 * this scan. Pure + unit-tested. A threshold `off` is "crossed" once daysLeft <= off.
 * To avoid spamming on a first/late scan, fire only the most urgent uncrossed-and-sent
 * threshold and mark any earlier (larger) crossed thresholds as handled too.
 */
export function reminderDue(
  daysLeft: number,
  offsets: number[],
  sent: number[],
): ReminderDecision {
  if (daysLeft < 0) return { fire: null, markSent: [] }; // expiry handled separately
  const crossed = offsets
    .filter((o) => o >= daysLeft && !sent.includes(o))
    .sort((a, b) => a - b);
  if (!crossed.length) return { fire: null, markSent: [] };
  return { fire: crossed[0], markSent: crossed };
}
