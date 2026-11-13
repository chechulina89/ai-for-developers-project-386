import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { buildApp } from './app.js';
import {
  MemoryStore,
  type StoredBooking,
  type StoredMeetingType,
} from './store.js';

const fixedNow = new Date('2026-11-10T09:00:00.000Z');
const firstDate = '2026-11-11';
const testMeetingType: StoredMeetingType = {
  id: 'online-consultation',
  title: 'Демонстрационная онлайн-консультация',
  description: 'Индивидуальная онлайн-встреча.',
  durationMinutes: [30, 45, 60],
  onlineInstructions: 'Подключение онлайн.',
  priceKzt: 5000,
  owner: {
    name: 'Демонстрационный специалист',
    description: 'Демонстрационный профиль.',
    photoUrl: '/demo-specialist.svg',
  },
};

type TestFetch = (
  input: string,
  init?: {
    method?: 'GET' | 'POST' | 'DELETE';
    headers?: Record<string, string>;
    body?: string;
  },
) => Promise<Response>;

async function withApi(
  run: (fetch: TestFetch, store: MemoryStore) => Promise<void>,
  options: {
    store?: MemoryStore;
    now?: () => Date;
    seedMeetingType?: boolean;
  } = {},
) {
  const store = options.store ?? new MemoryStore();
  if (options.seedMeetingType !== false) {
    store.addMeetingType(testMeetingType);
  }
  const app = buildApp({
    ownerLogin: 'owner@example.test',
    ownerPassword: 'a-test-password',
    now: options.now ?? (() => new Date(fixedNow)),
    store,
  });
  const fetch: TestFetch = async (input, init = {}) => {
    const url = new URL(input, 'http://127.0.0.1');
    const response = await app.inject({
      method: init.method ?? 'GET',
      url: `${url.pathname}${url.search}`,
      headers: init.headers,
      payload: init.body,
    });
    const headers = Object.fromEntries(
      Object.entries(response.headers).flatMap(([name, value]) =>
        value === undefined
          ? []
          : [[name, Array.isArray(value) ? value.join(', ') : String(value)]],
      ),
    );

    return new Response(response.statusCode === 204 ? null : response.body, {
      status: response.statusCode,
      headers,
    });
  };

  try {
    await run(fetch, store);
  } finally {
    await app.close();
  }
}

function bookingRequest(
  startAt: string,
  durationMinutes = 30,
  name = 'Алексей Клиент',
  selectedMeetingTypeId = testMeetingType.id,
) {
  return {
    meetingTypeId: selectedMeetingTypeId,
    startAt,
    durationMinutes,
    guest: { name, phone: '+7 (700) 123-45-67' },
  };
}

function idempotencyKey() {
  return randomUUID();
}

async function createBooking(
  fetch: TestFetch,
  startAt: string,
  durationMinutes: number,
  key = idempotencyKey(),
  name?: string,
  selectedMeetingTypeId = testMeetingType.id,
) {
  return fetch('/api/bookings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': key,
    },
    body: JSON.stringify(
      bookingRequest(startAt, durationMinutes, name, selectedMeetingTypeId),
    ),
  });
}

describe('booking HTTP API', () => {
  it('returns the configured demo offer and a complete 14-day availability range', async () => {
    await withApi(async (fetch) => {
      const offersResponse = await fetch('/api/meeting-types');
      const offers = await offersResponse.json();

      expect(offersResponse.status).toBe(200);
      expect(offers.meetingTypes).toHaveLength(1);
      expect(offers.meetingTypes[0].owner.name).toBe(
        'Демонстрационный специалист',
      );

      const availabilityResponse = await fetch(
        `/api/meeting-types/online-consultation/availability?from=${firstDate}&to=2026-11-24&durationMinutes=30`,
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
    await withApi(async (fetch) => {
      const response = await fetch(
        `/api/meeting-types/online-consultation/availability?from=2026-11-10&to=2026-11-25&durationMinutes=90`,
      );

      expect(response.status).toBe(422);
      expect(await response.json()).toMatchObject({
        code: 'VALIDATION_ERROR',
      });
    });
  });

  it('creates a booking and returns a confirmation without exposing the phone', async () => {
    await withApi(async (fetch) => {
      const response = await createBooking(
        fetch,
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
    await withApi(async (fetch) => {
      const response = await fetch('/api/bookings', {
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
    await withApi(async (fetch) => {
      const first = await createBooking(
        fetch,
        `${firstDate}T10:00:00+05:00`,
        60,
      );
      const overlap = await createBooking(
        fetch,
        `${firstDate}T10:30:00+05:00`,
        30,
      );
      const adjacent = await createBooking(
        fetch,
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
      async (fetch) => {
        const response = await createBooking(
          fetch,
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

  it('lets the owner create two types guests can book and rejects cross-type conflicts', async () => {
    await withApi(
      async (fetch) => {
        const login = await fetch('/api/owner/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            login: 'owner@example.test',
            password: 'a-test-password',
          }),
        });
        const cookie = login.headers.get('set-cookie')?.split(';')[0] ?? '';
        const createType = (title: string) =>
          fetch('/api/owner/meeting-types', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Cookie: cookie,
            },
            body: JSON.stringify({
              title,
              description: 'Подробный разбор вопроса клиента.',
              durationMinutes: [30, 60],
            }),
          });
        const firstCreated = await createType('Консультация');
        const firstType = await firstCreated.json();
        const secondCreated = await createType('Разбор ситуации');
        const secondType = await secondCreated.json();
        const list = await fetch('/api/meeting-types');
        const listBody = await list.json();

        expect(login.status).toBe(204);
        expect(firstCreated.status).toBe(201);
        expect(secondCreated.status).toBe(201);
        expect(secondType).toMatchObject({
          title: 'Разбор ситуации',
          durationMinutes: [30, 60],
        });
        expect(listBody.meetingTypes).toHaveLength(2);
        expect(
          listBody.meetingTypes.some(
            (meetingType: { id: string }) => meetingType.id === secondType.id,
          ),
        ).toBe(true);
        const availability = await fetch(
          `/api/meeting-types/${secondType.id}/availability?from=${firstDate}&to=2026-11-24&durationMinutes=30`,
        );
        const availabilityBody = await availability.json();
        expect(availability.status).toBe(200);
        expect(availabilityBody.dates[0].slots[0].startAt).toBe(
          `${firstDate}T09:00:00+05:00`,
        );

        const firstBooking = await createBooking(
          fetch,
          `${firstDate}T10:00:00+05:00`,
          30,
          idempotencyKey(),
          undefined,
          firstType.id,
        );
        const conflictingBooking = await fetch('/api/bookings', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Idempotency-Key': idempotencyKey(),
          },
          body: JSON.stringify(
            bookingRequest(
              `${firstDate}T10:00:00+05:00`,
              30,
              'Другой клиент',
              secondType.id,
            ),
          ),
        });

        expect(firstBooking.status).toBe(201);
        expect(conflictingBooking.status).toBe(409);
        expect(await conflictingBooking.json()).toMatchObject({
          code: 'SLOT_UNAVAILABLE',
        });
      },
      { seedMeetingType: false },
    );
  });

  it('serializes concurrent overlapping HTTP requests so exactly one wins', async () => {
    await withApi(async (fetch) => {
      const responses = await Promise.all([
        createBooking(fetch, `${firstDate}T13:00:00+05:00`, 60),
        createBooking(fetch, `${firstDate}T13:30:00+05:00`, 30),
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
    await withApi(async (fetch) => {
      const key = idempotencyKey();
      const first = await createBooking(
        fetch,
        `${firstDate}T14:00:00+05:00`,
        30,
        key,
      );
      const firstBody = await first.json();
      const replay = await createBooking(
        fetch,
        `${firstDate}T14:00:00+05:00`,
        30,
        key,
      );
      const replayBody = await replay.json();
      const changed = await createBooking(
        fetch,
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
      async (fetch) => {
        const key = idempotencyKey();
        const startAt = '2026-11-12T09:00:00+05:00';
        const first = await createBooking(fetch, startAt, 30, key);

        currentTime = new Date(currentTime.getTime() + 24 * 60 * 60 * 1000 + 1);
        const expiredReplay = await createBooking(fetch, startAt, 30, key);

        expect(first.status).toBe(201);
        expect(expiredReplay.status).toBe(409);
        expect(await expiredReplay.json()).toMatchObject({
          code: 'SLOT_UNAVAILABLE',
        });
      },
      { now: () => new Date(currentTime) },
    );
  });

  it('replays an idempotent request across the booking-window date boundary', async () => {
    let currentTime = new Date('2026-11-10T18:55:00.000Z');

    await withApi(
      async (fetch) => {
        const key = idempotencyKey();
        const startAt = `${firstDate}T09:00:00+05:00`;
        const first = await createBooking(fetch, startAt, 30, key);

        currentTime = new Date('2026-11-10T19:05:00.000Z');
        const replay = await createBooking(fetch, startAt, 30, key);

        expect(first.status).toBe(201);
        expect(replay.status).toBe(201);
        expect(await replay.json()).toEqual(await first.json());
      },
      { now: () => new Date(currentTime) },
    );
  });

  it('protects owner bookings, applies temporary login rate limits, and logs out', async () => {
    await withApi(async (fetch) => {
      const unauthorized = await fetch('/api/owner/bookings');
      expect(unauthorized.status).toBe(401);
      expect(await unauthorized.json()).toMatchObject({
        code: 'UNAUTHENTICATED',
      });

      const wrongCredentials = await fetch('/api/owner/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ login: 'wrong', password: 'wrong' }),
      });
      expect(wrongCredentials.status).toBe(401);
      expect(await wrongCredentials.json()).toMatchObject({
        code: 'INVALID_CREDENTIALS',
      });

      const successfulLogin = await fetch('/api/owner/session', {
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

      await createBooking(fetch, `${firstDate}T15:00:00+05:00`, 30);
      const ownerBookings = await fetch('/api/owner/bookings', {
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

      const logout = await fetch('/api/owner/session', {
        method: 'DELETE',
        headers: { Cookie: cookie?.split(';')[0] ?? '' },
      });
      expect(logout.status).toBe(204);

      const afterLogout = await fetch('/api/owner/bookings', {
        headers: { Cookie: cookie?.split(';')[0] ?? '' },
      });
      expect(afterLogout.status).toBe(401);
    });
  });

  it('expires the owner session after seven days', async () => {
    let currentTime = new Date(fixedNow);

    await withApi(
      async (fetch) => {
        const login = await fetch('/api/owner/session', {
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
        const response = await fetch('/api/owner/bookings', {
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
    await withApi(async (fetch) => {
      const attempts = await Promise.all(
        Array.from({ length: 5 }, () =>
          fetch('/api/owner/session', {
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
