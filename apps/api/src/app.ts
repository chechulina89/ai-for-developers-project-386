import {
  createHash,
  randomBytes,
  randomUUID,
  timingSafeEqual,
} from 'node:crypto';
import { resolve } from 'node:path';
import fastifyStatic from '@fastify/static';
import Fastify, { type FastifyReply, type FastifyRequest } from 'fastify';
import {
  formatZonedDateTime,
  getAvailabilitySlots,
  getBookingWindow,
  getLocalDateTime,
  intervalsOverlap,
  isDateKey,
  isMeetingDuration,
  meetingDurations,
  normalizePhone,
  timeZone,
} from './domain.js';
import {
  MemoryStore,
  type StoredBooking,
  type StoredMeetingType,
} from './store.js';

const sessionCookieName = 'meetly_owner_session';
const sessionLifetimeMs = 7 * 24 * 60 * 60 * 1000;
const idempotencyKeyPattern = /^[A-Za-z0-9._~-]{8,128}$/;
const excludedDates = new Set<string>();

const demoOwner = {
  name: 'Демонстрационный специалист',
  description:
    'Это демонстрационный профиль Meetly. Здесь будет информация о специалисте и его опыте.',
  photoUrl: '/demo-specialist.svg',
};

type AppConfig = {
  ownerLogin: string;
  ownerPassword: string;
  now?: () => Date;
  isProduction?: boolean;
  staticRoot?: string;
  store?: MemoryStore;
};

type ApiError = {
  code: string;
  message: string;
  fieldErrors?: Record<string, string>;
};

type CreateBookingInput = {
  meetingTypeId?: unknown;
  startAt?: unknown;
  durationMinutes?: unknown;
  guest?: unknown;
};

type Guest = {
  name?: unknown;
  phone?: unknown;
};

type OwnerLoginInput = {
  login?: unknown;
  password?: unknown;
};

type CreateMeetingTypeInput = {
  title?: unknown;
  description?: unknown;
  durationMinutes?: unknown;
};

function errorBody(
  code: string,
  message: string,
  fieldErrors?: Record<string, string>,
): ApiError {
  return fieldErrors ? { code, message, fieldErrors } : { code, message };
}

function sendError(
  reply: FastifyReply,
  status: number,
  code: string,
  message: string,
  fieldErrors?: Record<string, string>,
) {
  return reply.status(status).send(errorBody(code, message, fieldErrors));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function safeEqual(first: string, second: string) {
  const firstHash = createHash('sha256').update(first).digest();
  const secondHash = createHash('sha256').update(second).digest();

  return timingSafeEqual(firstHash, secondHash);
}

function getCookie(request: FastifyRequest, name: string) {
  const cookieHeader = request.headers.cookie;

  if (!cookieHeader) return null;

  for (const part of cookieHeader.split(';')) {
    const [key, ...valueParts] = part.trim().split('=');

    if (key === name) return valueParts.join('=');
  }

  return null;
}

function createSessionCookie(token: string, isProduction: boolean) {
  return [
    `${sessionCookieName}=${token}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${sessionLifetimeMs / 1000}`,
    ...(isProduction ? ['Secure'] : []),
  ].join('; ');
}

function clearSessionCookie(isProduction: boolean) {
  return [
    `${sessionCookieName}=`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    'Max-Age=0',
    ...(isProduction ? ['Secure'] : []),
  ].join('; ');
}

function createConfirmation(booking: StoredBooking) {
  return {
    meetingTypeTitle: booking.meetingTypeTitle,
    durationMinutes: booking.durationMinutes,
    startAt: formatZonedDateTime(booking.startAt),
    endAt: formatZonedDateTime(booking.endAt),
    ownerName: demoOwner.name,
    guestName: booking.guestName,
    confirmationCode: booking.confirmationCode,
  };
}

function isOwnerAuthenticated(
  request: FastifyRequest,
  store: MemoryStore,
  now: number,
) {
  const token = getCookie(request, sessionCookieName);

  return Boolean(token && store.hasSession(token, now));
}

function validateBookingInput(
  input: unknown,
  now: Date,
  meetingTypes: StoredMeetingType[],
  enforceBookingWindow = true,
): {
  value?: {
    meetingType: StoredMeetingType;
    startAt: number;
    durationMinutes: (typeof meetingDurations)[number];
    guestName: string;
    guestPhone: string;
    fingerprint: string;
  };
  fieldErrors?: Record<string, string>;
} {
  const fieldErrors: Record<string, string> = {};

  if (!isRecord(input)) {
    return { fieldErrors: { body: 'Укажите данные бронирования.' } };
  }

  const body = input as CreateBookingInput;
  const guest = isRecord(body.guest) ? (body.guest as Guest) : {};
  const selectedMeetingType = meetingTypes.find(
    (meetingType) => meetingType.id === body.meetingTypeId,
  );
  const guestName = typeof guest.name === 'string' ? guest.name.trim() : '';
  const normalizedPhone =
    typeof guest.phone === 'string' ? normalizePhone(guest.phone) : null;
  const durationMinutes = body.durationMinutes;
  const startAtString = typeof body.startAt === 'string' ? body.startAt : '';
  const startAt = Date.parse(startAtString);
  const validDuration = isMeetingDuration(durationMinutes);
  const startAtMatch = startAtString.match(
    /^(\d{4}-\d{2}-\d{2})T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d+)?(?:Z|[+-](?:0\d|1\d|2[0-3]):[0-5]\d)$/i,
  );
  const validStartAt =
    Boolean(startAtMatch && isDateKey(startAtMatch[1] ?? '')) &&
    Number.isFinite(startAt);

  if (!selectedMeetingType) {
    fieldErrors.meetingTypeId = 'Выберите доступное предложение.';
  }
  if (
    !validDuration ||
    (selectedMeetingType &&
      !selectedMeetingType.durationMinutes.includes(durationMinutes))
  ) {
    fieldErrors.durationMinutes =
      'Выберите доступную для этого типа длительность.';
  }
  if (!guestName || guestName.length > 120) {
    fieldErrors['guest.name'] = 'Укажите имя длиной не более 120 символов.';
  }
  if (!normalizedPhone) {
    fieldErrors['guest.phone'] =
      'Укажите действующий номер телефона Казахстана.';
  }
  if (!validStartAt) {
    fieldErrors.startAt = 'Укажите корректные дату и время.';
  }

  if (validStartAt && validDuration && selectedMeetingType) {
    const local = getLocalDateTime(new Date(startAt));
    const window = getBookingWindow(now);
    const windowIndex = window.indexOf(local.dateKey);
    const minuteOfDay =
      Number(local.time.slice(0, 2)) * 60 + Number(local.time.slice(3, 5));

    if (
      !isDateKey(local.dateKey) ||
      (enforceBookingWindow && windowIndex < 0) ||
      minuteOfDay % 30 !== 0 ||
      new Date(startAt).getUTCSeconds() !== 0 ||
      new Date(startAt).getUTCMilliseconds() !== 0
    ) {
      fieldErrors.startAt = 'Выберите доступное время в ближайшие 14 дней.';
    } else {
      const allowedSlots = getAvailabilitySlots(
        local.dateKey,
        durationMinutes,
        [],
        excludedDates,
      );
      const isAllowedTime = allowedSlots.some(
        (slot) => Date.parse(slot.startAt) === startAt,
      );

      if (!isAllowedTime) {
        fieldErrors.startAt =
          'Выберите время в рабочем расписании специалиста.';
      }
    }
  }

  if (Object.keys(fieldErrors).length > 0) return { fieldErrors };
  if (!validDuration || !normalizedPhone || !selectedMeetingType) {
    return { fieldErrors };
  }

  const normalized = {
    meetingTypeId: selectedMeetingType.id,
    startAt,
    durationMinutes,
    guestName,
    guestPhone: normalizedPhone,
  };

  return {
    value: {
      meetingType: selectedMeetingType,
      startAt,
      durationMinutes,
      guestName,
      guestPhone: normalizedPhone,
      fingerprint: JSON.stringify(normalized),
    },
  };
}

export function buildApp(config: AppConfig) {
  const app = Fastify({ logger: true });
  const store = config.store ?? new MemoryStore();
  const now = config.now ?? (() => new Date());
  const isProduction =
    config.isProduction ?? process.env.NODE_ENV === 'production';
  const ownerAuthConfigured = Boolean(
    config.ownerLogin && config.ownerPassword,
  );

  if (!ownerAuthConfigured) {
    app.log.warn(
      'Owner sign-in is disabled because OWNER_LOGIN and OWNER_PASSWORD are not configured',
    );
  }

  if (isProduction) {
    app.register(fastifyStatic, {
      root: config.staticRoot ?? resolve(process.cwd(), 'apps/web/dist'),
      prefix: '/',
    });
  }

  app.setErrorHandler((error, request, reply) => {
    if (isRecord(error) && error.statusCode === 400) {
      return sendError(
        reply,
        422,
        'VALIDATION_ERROR',
        'Проверьте введённые данные.',
      );
    }

    request.log.error({ err: error }, 'Unhandled API error');

    return sendError(
      reply,
      500,
      'INTERNAL_SERVER_ERROR',
      'Не удалось обработать запрос. Попробуйте позже.',
    );
  });

  app.get('/health', async () => ({ status: 'ok' }));

  app.get('/api/meeting-types', async () => ({
    meetingTypes: store.meetingTypes,
  }));

  app.get<{
    Params: { meetingTypeId: string };
    Querystring: {
      from?: string;
      to?: string;
      durationMinutes?: string;
    };
  }>(
    '/api/meeting-types/:meetingTypeId/availability',
    async (request, reply) => {
      const { meetingTypeId: requestedTypeId } = request.params;
      const { from, to, durationMinutes: durationParam } = request.query;
      const duration = Number(durationParam);

      const selectedMeetingType = store.meetingTypes.find(
        (meetingType) => meetingType.id === requestedTypeId,
      );

      if (
        !selectedMeetingType ||
        !from ||
        !to ||
        !isMeetingDuration(duration)
      ) {
        return sendError(
          reply,
          422,
          'VALIDATION_ERROR',
          'Проверьте тип встречи, диапазон дат и длительность.',
        );
      }

      if (!selectedMeetingType.durationMinutes.includes(duration)) {
        return sendError(
          reply,
          422,
          'VALIDATION_ERROR',
          'Выберите доступную для этого типа длительность.',
        );
      }

      const dates = getBookingWindow(now());
      const fromIndex = dates.indexOf(from);
      const toIndex = dates.indexOf(to);

      if (
        !isDateKey(from) ||
        !isDateKey(to) ||
        fromIndex < 0 ||
        toIndex < fromIndex
      ) {
        return sendError(
          reply,
          422,
          'VALIDATION_ERROR',
          'Диапазон должен находиться внутри ближайших 14 календарных дат.',
        );
      }

      return {
        timeZone,
        from,
        to,
        dates: dates.slice(fromIndex, toIndex + 1).map((date) => ({
          date,
          slots: getAvailabilitySlots(
            date,
            duration,
            store.bookings,
            excludedDates,
          ),
        })),
      };
    },
  );

  app.post<{ Body: CreateBookingInput }>(
    '/api/bookings',
    async (request, reply) => {
      const fingerprintValidation = validateBookingInput(
        request.body,
        now(),
        store.meetingTypes,
        false,
      );

      if (!fingerprintValidation.value) {
        return sendError(
          reply,
          422,
          'VALIDATION_ERROR',
          'Проверьте введённые данные.',
          fingerprintValidation.fieldErrors,
        );
      }

      const rawIdempotencyKey = request.headers['idempotency-key'];
      const idempotencyKey =
        typeof rawIdempotencyKey === 'string' ? rawIdempotencyKey : '';

      if (!idempotencyKeyPattern.test(idempotencyKey)) {
        return sendError(
          reply,
          422,
          'VALIDATION_ERROR',
          'Передайте корректный ключ идемпотентности.',
          { idempotencyKey: 'Ключ должен содержать от 8 до 128 символов.' },
        );
      }

      const currentTime = now().getTime();
      const previous = store.getIdempotencyRecord(idempotencyKey, currentTime);

      if (previous) {
        if (previous.fingerprint !== fingerprintValidation.value.fingerprint) {
          return sendError(
            reply,
            409,
            'IDEMPOTENCY_KEY_REUSED',
            'Этот ключ уже использован для других данных.',
          );
        }

        return reply.status(201).send(createConfirmation(previous.booking));
      }

      const validation = validateBookingInput(
        request.body,
        now(),
        store.meetingTypes,
      );

      if (!validation.value) {
        return sendError(
          reply,
          422,
          'VALIDATION_ERROR',
          'Проверьте введённые данные.',
          validation.fieldErrors,
        );
      }

      const endAt =
        validation.value.startAt + validation.value.durationMinutes * 60_000;
      const candidate = { startAt: validation.value.startAt, endAt };

      if (
        store.bookings.some((booking) => intervalsOverlap(candidate, booking))
      ) {
        return sendError(
          reply,
          409,
          'SLOT_UNAVAILABLE',
          'Это время уже заняли. Выберите другое.',
        );
      }

      let confirmationCode: string;
      do {
        confirmationCode = `MLY-${randomBytes(4).toString('hex').toUpperCase()}`;
      } while (
        store.bookings.some(
          (booking) => booking.confirmationCode === confirmationCode,
        )
      );

      const booking: StoredBooking = {
        meetingTypeId: validation.value.meetingType.id,
        meetingTypeTitle: validation.value.meetingType.title,
        durationMinutes: validation.value.durationMinutes,
        startAt: validation.value.startAt,
        endAt,
        guestName: validation.value.guestName,
        guestPhone: validation.value.guestPhone,
        confirmationCode,
      };

      store.addBooking(booking);
      store.saveIdempotencyRecord(
        idempotencyKey,
        validation.value.fingerprint,
        booking,
        currentTime,
      );

      return reply.status(201).send(createConfirmation(booking));
    },
  );

  app.post<{ Body: OwnerLoginInput }>(
    '/api/owner/session',
    async (request, reply) => {
      if (!ownerAuthConfigured) {
        return sendError(
          reply,
          503,
          'OWNER_AUTH_NOT_CONFIGURED',
          'Вход владельца недоступен: задайте OWNER_LOGIN и OWNER_PASSWORD.',
        );
      }

      const ip = request.ip;
      const retryAfter = store.getLoginRetryAfter(ip, now().getTime());

      if (retryAfter > 0) {
        reply.header('Retry-After', String(retryAfter));

        return sendError(
          reply,
          429,
          'RATE_LIMITED',
          'Слишком много попыток входа. Попробуйте позже.',
        );
      }

      const body = isRecord(request.body) ? request.body : {};
      const login = typeof body.login === 'string' ? body.login : '';
      const password = typeof body.password === 'string' ? body.password : '';
      const loginMatches = safeEqual(login, config.ownerLogin);
      const passwordMatches = safeEqual(password, config.ownerPassword);
      const authenticated = loginMatches && passwordMatches;

      if (!authenticated) {
        const delaySeconds = store.recordFailedLogin(ip, now().getTime());

        if (delaySeconds > 0) {
          reply.header('Retry-After', String(delaySeconds));
        }

        return sendError(
          reply,
          delaySeconds > 0 ? 429 : 401,
          delaySeconds > 0 ? 'RATE_LIMITED' : 'INVALID_CREDENTIALS',
          delaySeconds > 0
            ? 'Слишком много попыток входа. Попробуйте позже.'
            : 'Неверный логин или пароль.',
        );
      }

      store.clearLoginAttempts(ip);
      const token = randomBytes(32).toString('base64url');
      store.createSession(token, now().getTime() + sessionLifetimeMs);

      return reply
        .header('Set-Cookie', createSessionCookie(token, isProduction))
        .status(204)
        .send();
    },
  );

  app.delete('/api/owner/session', async (request, reply) => {
    const token = getCookie(request, sessionCookieName);

    if (token) store.deleteSession(token);

    return reply
      .header('Set-Cookie', clearSessionCookie(isProduction))
      .status(204)
      .send();
  });

  app.post<{ Body: CreateMeetingTypeInput }>(
    '/api/owner/meeting-types',
    async (request, reply) => {
      if (!isOwnerAuthenticated(request, store, now().getTime())) {
        return sendError(
          reply,
          401,
          'UNAUTHENTICATED',
          'Войдите, чтобы управлять типами встреч.',
        );
      }

      const body = isRecord(request.body) ? request.body : {};
      const title = typeof body.title === 'string' ? body.title.trim() : '';
      const description =
        typeof body.description === 'string' ? body.description.trim() : '';
      const rawDurations = Array.isArray(body.durationMinutes)
        ? body.durationMinutes
        : [];
      const durations = rawDurations.filter(isMeetingDuration);
      const fieldErrors: Record<string, string> = {};

      if (!title || title.length > 120) {
        fieldErrors.title = 'Укажите название длиной до 120 символов.';
      }
      if (!description || description.length > 500) {
        fieldErrors.description = 'Укажите описание длиной до 500 символов.';
      }
      if (
        durations.length === 0 ||
        durations.length !== rawDurations.length ||
        new Set(durations).size !== durations.length
      ) {
        fieldErrors.durationMinutes =
          'Выберите одну или несколько длительностей: 30, 45 или 60 минут.';
      }

      if (Object.keys(fieldErrors).length > 0) {
        return sendError(
          reply,
          422,
          'VALIDATION_ERROR',
          'Проверьте данные типа встречи.',
          fieldErrors,
        );
      }

      const meetingType: StoredMeetingType = {
        id: randomUUID(),
        title,
        description,
        durationMinutes: durations,
        onlineInstructions: 'Ссылка для подключения будет отправлена отдельно.',
        priceKzt: 5000,
        owner: demoOwner,
      };

      store.addMeetingType(meetingType);

      return reply.status(201).send(meetingType);
    },
  );

  app.get('/api/owner/bookings', async (request, reply) => {
    if (!isOwnerAuthenticated(request, store, now().getTime())) {
      return sendError(
        reply,
        401,
        'UNAUTHENTICATED',
        'Войдите, чтобы просмотреть встречи.',
      );
    }

    const currentTime = now().getTime();
    const bookings = store.bookings
      .filter((booking) => booking.startAt > currentTime)
      .sort((first, second) => first.startAt - second.startAt)
      .map((booking) => ({
        meetingTypeTitle: booking.meetingTypeTitle,
        startAt: formatZonedDateTime(booking.startAt),
        endAt: formatZonedDateTime(booking.endAt),
        guestName: booking.guestName,
        guestPhone: booking.guestPhone,
        confirmationCode: booking.confirmationCode,
      }));

    return { timeZone, bookings };
  });

  if (isProduction) {
    app.setNotFoundHandler((request, reply) => {
      const pathname = request.url.split('?')[0] ?? '';

      if (
        (request.method !== 'GET' && request.method !== 'HEAD') ||
        pathname === '/api' ||
        pathname.startsWith('/api/')
      ) {
        return sendError(reply, 404, 'NOT_FOUND', 'Маршрут не найден.');
      }

      return reply
        .type('text/html')
        .sendFile('index.html', { maxAge: 0, immutable: false });
    });
  }

  return app;
}

export function readApiConfigFromEnv(): AppConfig {
  const ownerLogin = process.env.OWNER_LOGIN?.trim();
  const ownerPassword = process.env.OWNER_PASSWORD;

  if (Boolean(ownerLogin) !== Boolean(ownerPassword)) {
    throw new Error(
      'Set both OWNER_LOGIN and OWNER_PASSWORD, or leave both unset to disable owner sign-in',
    );
  }

  return {
    ownerLogin: ownerLogin ?? '',
    ownerPassword: ownerPassword ?? '',
  };
}
