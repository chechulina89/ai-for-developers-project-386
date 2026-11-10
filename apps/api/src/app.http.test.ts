import { randomUUID } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import { describe, expect, it } from 'vitest';
import { buildApp } from './app.js';
import { MemoryStore, type StoredBooking } from './store.js';

const fixedNow = new Date('2026-11-10T09:00:00.000Z');
const firstDate = '2026-11-11';

async function withApi(
  run: (baseUrl: string, store: MemoryStore) => Promise<void>,
  options: {
    store?: MemoryStore;
    now?: () => Date;
  } = {},
) {
  const store = options.store ?? new MemoryStore();
  const app = buildApp({
    ownerLogin: 'owner@example.test',
    ownerPassword: 'a-test-password',
    now: options.now ?? (() => new Date(fixedNow)),
    store,
  });

  await app.listen({ host: '127.0.0.1', port: 0 });

  const address = app.server.address() as AddressInfo;

  try {
    await run(`http://127.0.0.1:${address.port}`, store);
  } finally {
    await app.close();
  }
}

function bookingRequest(
  startAt: string,
  durationMinutes = 30,
  name = 'Алексей Клиент',
) {
  return {
    meetingTypeId: 'online-consultation',
    startAt,
    durationMinutes,
    guest: { name, phone: '+7 (700) 123-45-67' },
  };
}

function idempotencyKey() {
  return randomUUID();
}

async function createBooking(
  baseUrl: string,
  startAt: string,
  durationMinutes: number,
  key = idempotencyKey(),
  name?: string,
) {
  return fetch(`${baseUrl}/api/bookings`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': key,
    },
    body: JSON.stringify(bookingRequest(startAt, durationMinutes, name)),
  });
}

describe('booking HTTP API', () => {
  it('returns the configured demo offer and a complete 14-day availability range', async () => {
    await withApi(async (baseUrl) => {
      const offersResponse = await fetch(`${baseUrl}/api/meeting-types`);
      const offers = await offersResponse.json();

      expect(offersResponse.status).toBe(200);
      expect(offers.meetingTypes).toHaveLength(1);
      expect(offers.meetingTypes[0].owner.name).toBe(
        'Демонстрационный специалист',
      );

      const availabilityResponse = await fetch(
        `${baseUrl}/api/meeting-types/online-consultation/availability?from=${firstDate}&to=2026-11-24&durationMinutes=30`,
      );
      const availability = await availabilityResponse.json();

      expect(availabilityResponse.status).toBe(200);
      expect(availability.timeZone).toBe('Asia/Almaty');
      expect(availability.dates).toHaveLength(14);
      expect(availability.dates[0].slots[0].startAt).toBe(
        `${firstDate}T09:00:00+05:00`,
      );
      expect(
        availability.dates.find(
          (date: { date: string }) => date.date === '2026-11-14',
        ).slots,
      ).toEqual([]);
    });
  });

  it('returns a validation error for an invalid availability range', async () => {
    await withApi(async (baseUrl) => {
      const response = await fetch(
        `${baseUrl}/api/meeting-types/online-consultation/availability?from=2026-11-10&to=2026-11-25&durationMinutes=90`,
      );

      expect(response.status).toBe(422);
      expect(await response.json()).toMatchObject({
        code: 'VALIDATION_ERROR',
      });
    });
  });

  it('creates a booking and returns a confirmation without exposing the phone', async () => {
    await withApi(async (baseUrl) => {
      const response = await createBooking(
        baseUrl,
        `${firstDate}T09:00:00+05:00`,
        30,
      );
      const confirmation = await response.json();

      expect(response.status).toBe(201);
      expect(confirmation).toMatchObject({
        meetingTypeTitle: 'Демонстрационная онлайн-консультация',
        durationMinutes: 30,
        ownerName: 'Демонстрационный специалист',
        guestName: 'Алексей Клиент',
      });
      expect(confirmation.confirmationCode).toMatch(/^MLY-[A-F0-9]{8}$/);
      expect(confirmation).not.toHaveProperty('guestPhone');
      expect(confirmation).not.toHaveProperty('phone');
    });
  });

  it('rejects invalid booking data with field errors', async () => {
    await withApi(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/bookings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKey(),
        },
        body: JSON.stringify(
          bookingRequest(`${firstDate}T12:30:00+05:00`, 45, ''),
        ),
      });

      expect(response.status).toBe(422);
      expect(await response.json()).toMatchObject({
        code: 'VALIDATION_ERROR',
        fieldErrors: {
          'guest.name': expect.any(String),
          startAt: expect.any(String),
        },
      });
    });
  });

  it('blocks partial overlap between durations but allows exact adjacency', async () => {
    await withApi(async (baseUrl) => {
      const first = await createBooking(
        baseUrl,
        `${firstDate}T10:00:00+05:00`,
        60,
      );
      const overlap = await createBooking(
        baseUrl,
        `${firstDate}T10:30:00+05:00`,
        30,
      );
      const adjacent = await createBooking(
        baseUrl,
        `${firstDate}T11:00:00+05:00`,
        30,
      );

      expect(first.status).toBe(201);
      expect(overlap.status).toBe(409);
      expect(await overlap.json()).toMatchObject({
        code: 'SLOT_UNAVAILABLE',
        message: 'Это время уже заняли. Выберите другое.',
      });
      expect(adjacent.status).toBe(201);
    });
  });

  it('checks overlapping bookings created for another meeting type', async () => {
    const store = new MemoryStore();
    const existing: StoredBooking = {
      meetingTypeId: 'another-meeting-type',
      meetingTypeTitle: 'Другая встреча',
      durationMinutes: 60,
      startAt: Date.parse(`${firstDate}T10:00:00+05:00`),
      endAt: Date.parse(`${firstDate}T11:00:00+05:00`),
      guestName: 'Предыдущий клиент',
      guestPhone: '+77001234567',
      confirmationCode: 'MLY-EXISTING',
    };
    store.addBooking(existing);

    await withApi(
      async (baseUrl) => {
        const response = await createBooking(
          baseUrl,
          `${firstDate}T10:30:00+05:00`,
          30,
        );

        expect(response.status).toBe(409);
        expect(await response.json()).toMatchObject({
          code: 'SLOT_UNAVAILABLE',
        });
      },
      { store },
    );
  });

  it('serializes concurrent overlapping HTTP requests so exactly one wins', async () => {
    await withApi(async (baseUrl) => {
      const responses = await Promise.all([
        createBooking(baseUrl, `${firstDate}T13:00:00+05:00`, 60),
        createBooking(baseUrl, `${firstDate}T13:30:00+05:00`, 30),
      ]);

      expect(responses.map((response) => response.status).sort()).toEqual([
        201, 409,
      ]);
      const conflict = responses.find((response) => response.status === 409);

      expect(await conflict?.json()).toMatchObject({
        code: 'SLOT_UNAVAILABLE',
      });
    });
  });

  it('replays an identical idempotent request and rejects a reused key with changed data', async () => {
    await withApi(async (baseUrl) => {
      const key = idempotencyKey();
      const first = await createBooking(
        baseUrl,
        `${firstDate}T14:00:00+05:00`,
        30,
        key,
      );
      const firstBody = await first.json();
      const replay = await createBooking(
        baseUrl,
        `${firstDate}T14:00:00+05:00`,
        30,
        key,
      );
      const replayBody = await replay.json();
      const changed = await createBooking(
        baseUrl,
        `${firstDate}T14:00:00+05:00`,
        30,
        key,
        'Другой клиент',
      );

      expect(first.status).toBe(201);
      expect(replay.status).toBe(201);
      expect(replayBody).toEqual(firstBody);
      expect(changed.status).toBe(409);
      expect(await changed.json()).toMatchObject({
        code: 'IDEMPOTENCY_KEY_REUSED',
      });
    });
  });

  it('expires idempotency records after 24 hours while keeping the booking occupied', async () => {
    let currentTime = new Date(fixedNow);

    await withApi(
      async (baseUrl) => {
        const key = idempotencyKey();
        const startAt = '2026-11-12T09:00:00+05:00';
        const first = await createBooking(baseUrl, startAt, 30, key);

        currentTime = new Date(currentTime.getTime() + 24 * 60 * 60 * 1000 + 1);
        const expiredReplay = await createBooking(baseUrl, startAt, 30, key);

        expect(first.status).toBe(201);
        expect(expiredReplay.status).toBe(409);
        expect(await expiredReplay.json()).toMatchObject({
          code: 'SLOT_UNAVAILABLE',
        });
      },
      { now: () => new Date(currentTime) },
    );
  });

  it('protects owner bookings, applies temporary login rate limits, and logs out', async () => {
    await withApi(async (baseUrl) => {
      const unauthorized = await fetch(`${baseUrl}/api/owner/bookings`);
      expect(unauthorized.status).toBe(401);
      expect(await unauthorized.json()).toMatchObject({
        code: 'UNAUTHENTICATED',
      });

      const wrongCredentials = await fetch(`${baseUrl}/api/owner/session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ login: 'wrong', password: 'wrong' }),
      });
      expect(wrongCredentials.status).toBe(401);
      expect(await wrongCredentials.json()).toMatchObject({
        code: 'INVALID_CREDENTIALS',
      });

      const successfulLogin = await fetch(`${baseUrl}/api/owner/session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          login: 'owner@example.test',
          password: 'a-test-password',
        }),
      });
      const cookie = successfulLogin.headers.get('set-cookie');
      expect(successfulLogin.status).toBe(204);
      expect(cookie).toContain('HttpOnly');
      expect(cookie).toContain('SameSite=Lax');

      await createBooking(baseUrl, `${firstDate}T15:00:00+05:00`, 30);
      const ownerBookings = await fetch(`${baseUrl}/api/owner/bookings`, {
        headers: { Cookie: cookie?.split(';')[0] ?? '' },
      });

      expect(ownerBookings.status).toBe(200);
      expect(await ownerBookings.json()).toMatchObject({
        timeZone: 'Asia/Almaty',
        bookings: [
          {
            guestName: 'Алексей Клиент',
            guestPhone: '+77001234567',
          },
        ],
      });

      const logout = await fetch(`${baseUrl}/api/owner/session`, {
        method: 'DELETE',
        headers: { Cookie: cookie?.split(';')[0] ?? '' },
      });
      expect(logout.status).toBe(204);

      const afterLogout = await fetch(`${baseUrl}/api/owner/bookings`, {
        headers: { Cookie: cookie?.split(';')[0] ?? '' },
      });
      expect(afterLogout.status).toBe(401);
    });
  });

  it('expires the owner session after seven days', async () => {
    let currentTime = new Date(fixedNow);

    await withApi(
      async (baseUrl) => {
        const login = await fetch(`${baseUrl}/api/owner/session`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            login: 'owner@example.test',
            password: 'a-test-password',
          }),
        });
        const cookie = login.headers.get('set-cookie')?.split(';')[0] ?? '';

        currentTime = new Date(
          currentTime.getTime() + 7 * 24 * 60 * 60 * 1000 + 1,
        );
        const response = await fetch(`${baseUrl}/api/owner/bookings`, {
          headers: { Cookie: cookie },
        });

        expect(login.status).toBe(204);
        expect(response.status).toBe(401);
        expect(await response.json()).toMatchObject({
          code: 'UNAUTHENTICATED',
        });
      },
      { now: () => new Date(currentTime) },
    );
  });

  it('returns 429 with Retry-After after repeated failed login attempts', async () => {
    await withApi(async (baseUrl) => {
      const attempts = await Promise.all(
        Array.from({ length: 5 }, () =>
          fetch(`${baseUrl}/api/owner/session`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ login: 'wrong', password: 'wrong' }),
          }),
        ),
      );

      const limited = attempts.find((response) => response.status === 429);

      expect(limited).toBeDefined();
      expect(limited?.headers.get('retry-after')).toMatch(/^\d+$/);
      expect(await limited?.json()).toMatchObject({ code: 'RATE_LIMITED' });
    });
  });
});
