import { daysUntil, reminderDue } from './reminders';

describe('daysUntil', () => {
  it('counts whole days to a future date and negatives past', () => {
    const now = new Date('2026-06-10T00:00:00Z');
    expect(daysUntil('2026-06-20', now)).toBe(10);
    expect(daysUntil('2026-06-05', now)).toBe(-5);
  });
});

describe('reminderDue', () => {
  const offsets = [30, 15, 3];

  it('fires the 30-day reminder when 30 days out and nothing sent', () => {
    expect(reminderDue(30, offsets, [])).toEqual({ fire: 30, markSent: [30] });
  });

  it('fires 15 once 30 already sent', () => {
    expect(reminderDue(15, offsets, [30])).toEqual({ fire: 15, markSent: [15] });
  });

  it('does not refire an already-sent threshold', () => {
    expect(reminderDue(2, offsets, [30, 15, 3])).toEqual({ fire: null, markSent: [] });
  });

  it('on a late first scan fires the most urgent and marks earlier crossed thresholds handled', () => {
    // 10 days out, nothing sent: thresholds 30 and 15 are crossed -> fire 15, mark [15,30]
    expect(reminderDue(10, offsets, [])).toEqual({ fire: 15, markSent: [15, 30] });
  });

  it('returns nothing once expired (handled separately)', () => {
    expect(reminderDue(-1, offsets, [])).toEqual({ fire: null, markSent: [] });
  });
});
