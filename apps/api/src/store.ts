import type { BookingInterval, MeetingDuration } from './domain.js';

export type StoredBooking = BookingInterval & {
  meetingTypeId: string;
  meetingTypeTitle: string;
  durationMinutes: MeetingDuration;
  guestName: string;
  guestPhone: string;
  confirmationCode: string;
};

type IdempotencyRecord = {
  fingerprint: string;
  booking: StoredBooking;
  createdAt: number;
};

type LoginAttempt = {
  count: number;
  windowStartedAt: number;
  blockedUntil: number;
};

const idempotencyWindowMs = 24 * 60 * 60 * 1000;
const loginWindowMs = 15 * 60 * 1000;
const loginLimit = 5;

export class MemoryStore {
  readonly bookings: StoredBooking[] = [];
  readonly #idempotency = new Map<string, IdempotencyRecord>();
  readonly #sessions = new Map<string, number>();
  readonly #loginAttempts = new Map<string, LoginAttempt>();

  getIdempotencyRecord(key: string, now: number) {
    for (const [storedKey, record] of this.#idempotency) {
      if (now - record.createdAt >= idempotencyWindowMs) {
        this.#idempotency.delete(storedKey);
      }
    }

    const record = this.#idempotency.get(key);

    return record;
  }

  saveIdempotencyRecord(
    key: string,
    fingerprint: string,
    booking: StoredBooking,
    now: number,
  ) {
    this.#idempotency.set(key, { fingerprint, booking, createdAt: now });
  }

  addBooking(booking: StoredBooking) {
    this.bookings.push(booking);
  }

  createSession(token: string, expiresAt: number) {
    this.#sessions.set(token, expiresAt);
  }

  hasSession(token: string, now: number) {
    const expiresAt = this.#sessions.get(token);

    if (expiresAt === undefined) return false;
    if (expiresAt <= now) {
      this.#sessions.delete(token);
      return false;
    }

    return true;
  }

  deleteSession(token: string) {
    this.#sessions.delete(token);
  }

  getLoginRetryAfter(ip: string, now: number) {
    const attempt = this.#loginAttempts.get(ip);

    if (!attempt || attempt.blockedUntil <= now) return 0;

    return Math.ceil((attempt.blockedUntil - now) / 1000);
  }

  recordFailedLogin(ip: string, now: number) {
    const previous = this.#loginAttempts.get(ip);
    const attempt =
      !previous || now - previous.windowStartedAt >= loginWindowMs
        ? { count: 0, windowStartedAt: now, blockedUntil: 0 }
        : previous;

    attempt.count += 1;
    if (attempt.count >= loginLimit) {
      attempt.blockedUntil = now + loginWindowMs;
    }
    this.#loginAttempts.set(ip, attempt);

    return this.getLoginRetryAfter(ip, now);
  }

  clearLoginAttempts(ip: string) {
    this.#loginAttempts.delete(ip);
  }
}
