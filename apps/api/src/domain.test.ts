import { describe, expect, it } from 'vitest';
import {
  getAvailabilitySlots,
  getBookingWindow,
  intervalsOverlap,
  normalizePhone,
} from './domain.js';

describe('booking domain rules', () => {
  it('uses the next 14 calendar dates in the owner time zone', () => {
    const dates = getBookingWindow(new Date('2026-11-10T22:00:00.000Z'));

    expect(dates).toHaveLength(14);
    expect(dates[0]).toBe('2026-11-12');
    expect(dates.at(-1)).toBe('2026-11-25');
    expect(dates).not.toContain('2026-11-11');
    expect(dates).not.toContain('2026-11-26');
  });

  it.each([
    [30, 16],
    [45, 14],
    [60, 14],
  ] as const)(
    'builds 30-minute start slots for %i-minute meetings',
    (duration, count) => {
      const slots = getAvailabilitySlots('2026-11-11', duration, [], new Set());

      expect(slots).toHaveLength(count);
      expect(slots[0]?.startAt).toBe('2026-11-11T09:00:00+05:00');
      expect(slots.every((slot) => slot.endAt > slot.startAt)).toBe(true);
      expect(slots.some((slot) => slot.startAt.includes('12:'))).toBe(false);
    },
  );

  it('does not offer slots on weekends or excluded dates', () => {
    expect(getAvailabilitySlots('2026-11-14', 30, [], new Set())).toEqual([]);
    expect(
      getAvailabilitySlots('2026-11-11', 30, [], new Set(['2026-11-11'])),
    ).toEqual([]);
  });

  it('treats meeting intervals as half-open and blocks partial overlaps', () => {
    const existing = {
      startAt: Date.parse('2026-11-11T10:00:00+05:00'),
      endAt: Date.parse('2026-11-11T11:00:00+05:00'),
    };

    expect(
      intervalsOverlap(
        {
          startAt: Date.parse('2026-11-11T10:30:00+05:00'),
          endAt: Date.parse('2026-11-11T11:00:00+05:00'),
        },
        existing,
      ),
    ).toBe(true);
    expect(
      intervalsOverlap(
        {
          startAt: Date.parse('2026-11-11T11:00:00+05:00'),
          endAt: Date.parse('2026-11-11T11:30:00+05:00'),
        },
        existing,
      ),
    ).toBe(false);
  });

  it.each([
    ['8 (700) 123-45-67', '+77001234567'],
    ['7001234567', '+77001234567'],
    ['+7 700 123 45 67', '+77001234567'],
    ['12345', null],
  ])('normalizes Kazakhstan phone %s', (phone, normalized) => {
    expect(normalizePhone(phone)).toBe(normalized);
  });
});
