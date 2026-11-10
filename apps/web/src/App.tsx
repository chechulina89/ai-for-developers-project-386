import {
  Badge,
  Button,
  Card,
  MantineProvider,
  SimpleGrid,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import {
  createBooking,
  createOwnerSession,
  deleteOwnerSession,
  getAvailability,
  getMeetingTypes,
  getOwnerBookings,
  MeetingDuration,
  type ApiError,
  type AvailabilityDate,
  type AvailabilitySlot,
  type MeetingType,
  type OwnerBooking,
} from '@project/api-client/src/generated/api.js';
import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';

const benefits = [
  {
    title: 'Предложения в одном месте',
    description:
      'Каталог поможет знакомиться с предложениями специалистов, не собирая информацию из разных источников.',
  },
  {
    title: 'Понятно о формате заранее',
    description:
      'Описание предложения поможет узнать о содержании и особенностях встречи до начала записи.',
  },
  {
    title: 'Удобный выбор',
    description:
      'Понятный путь поможет сориентироваться в типах встреч и выбрать подходящее предложение.',
  },
];

const steps = [
  {
    number: '01',
    title: 'Ознакомьтесь с типами встреч',
    description:
      'Выберите общий формат: консультацию, обучение или другой тип встречи.',
  },
  {
    number: '02',
    title: 'Изучите предложение специалиста',
    description:
      'Узнайте о содержании и особенностях конкретной услуги до перехода к записи.',
  },
  {
    number: '03',
    title: 'Перейдите к началу записи',
    description:
      'Выберите подходящее предложение и продолжите к планированию встречи.',
  },
];

const timezone = 'Asia/Almaty';

function Header() {
  return (
    <header className="topbar">
      <a className="identity" href="/" aria-label="Meetly — главная">
        <span className="mark" aria-hidden="true">
          M
        </span>
        <span className="identity-copy">
          <Text fw={700}>Meetly</Text>
          <Text size="xs" c="dimmed">
            Встречи и консультации
          </Text>
        </span>
      </a>
      <nav className="main-nav" aria-label="Основная навигация">
        <a href="/owner">Для владельца</a>
        <Badge color="teal" variant="light">
          В разработке
        </Badge>
      </nav>
    </header>
  );
}

function HomePage() {
  return (
    <main className="home-main">
      <section className="hero" aria-labelledby="page-title">
        <div className="hero-copy">
          <Text className="eyebrow">Сервис встреч и консультаций</Text>
          <Title id="page-title" order={1}>
            Встречи и консультации от специалистов
          </Title>
          <Text className="hero-summary" c="dimmed">
            Meetly помогает разобраться в предложениях специалистов, выбрать
            формат встречи и записаться на удобное время.
          </Text>
          <Button
            component="a"
            href="/booking"
            className="primary-action"
            size="lg"
          >
            Выбрать встречу
          </Button>
        </div>
        <div className="hero-art" aria-hidden="true">
          <span className="art-orbit art-orbit-outer" />
          <span className="art-orbit art-orbit-inner" />
          <span className="art-core">M</span>
          <span className="art-dot art-dot-one" />
          <span className="art-dot art-dot-two" />
        </div>
      </section>

      <section className="content-section" aria-labelledby="benefits-title">
        <div className="section-heading">
          <Text className="eyebrow">Для клиентов</Text>
          <Title id="benefits-title" order={2}>
            Выбирать будет проще
          </Title>
        </div>
        <SimpleGrid
          className="benefit-grid"
          cols={{ base: 1, sm: 3 }}
          spacing="md"
        >
          {benefits.map((benefit, index) => (
            <Card className="benefit-card" key={benefit.title} padding="lg">
              <Text className="card-index">0{index + 1}</Text>
              <Title order={3}>{benefit.title}</Title>
              <Text c="dimmed">{benefit.description}</Text>
            </Card>
          ))}
        </SimpleGrid>
      </section>

      <section
        className="content-section steps-section"
        aria-labelledby="steps-title"
      >
        <div className="section-heading">
          <Text className="eyebrow">Путь клиента</Text>
          <Title id="steps-title" order={2}>
            Как выбрать встречу
          </Title>
          <Text className="section-summary" c="dimmed">
            Изучите предложение специалиста, выберите время и подтвердите
            бронирование.
          </Text>
        </div>
        <ol className="steps-list">
          {steps.map((step) => (
            <li className="step-item" key={step.number}>
              <Text className="step-number">{step.number}</Text>
              <div>
                <Title order={3}>{step.title}</Title>
                <Text c="dimmed">{step.description}</Text>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="provider-note" aria-labelledby="providers-title">
        <div>
          <Text className="eyebrow">Для специалистов</Text>
          <Title id="providers-title" order={2}>
            Встречи от специалистов
          </Title>
        </div>
        <Text c="dimmed">
          Специалисты смогут представить свои услуги и встречи клиентам.
        </Text>
      </section>
    </main>
  );
}

function localDateKey(date: Date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const values = Object.fromEntries(
    parts.map(({ type, value }) => [type, value]),
  );

  return `${values.year}-${values.month}-${values.day}`;
}

function addDays(dateKey: string, days: number) {
  const [year, month, day] = dateKey.split('-').map(Number);

  return new Date(Date.UTC(year, month - 1, day + days))
    .toISOString()
    .slice(0, 10);
}

function bookingWindow() {
  const firstDate = addDays(localDateKey(new Date()), 1);

  return Array.from({ length: 14 }, (_, index) => addDays(firstDate, index));
}

function formatDate(dateKey: string) {
  return new Intl.DateTimeFormat('ru-RU', {
    timeZone: 'UTC',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(new Date(`${dateKey}T12:00:00.000Z`));
}

function formatTime(dateTime: string) {
  return new Intl.DateTimeFormat('ru-RU', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(dateTime));
}

function getApiError(value: unknown) {
  if (
    typeof value === 'object' &&
    value !== null &&
    'code' in value &&
    typeof value.code === 'string' &&
    'message' in value &&
    typeof value.message === 'string'
  ) {
    const fieldErrors =
      'fieldErrors' in value &&
      typeof value.fieldErrors === 'object' &&
      value.fieldErrors !== null
        ? Object.fromEntries(
            Object.entries(value.fieldErrors).filter(
              ([, fieldError]) => typeof fieldError === 'string',
            ),
          )
        : undefined;

    return {
      code: value.code,
      message: value.message,
      ...(fieldErrors ? { fieldErrors } : {}),
    } satisfies ApiError;
  }

  return null;
}

function BookingPage() {
  const [meetingType, setMeetingType] = useState<MeetingType | null>(null);
  const [dates, setDates] = useState<AvailabilityDate[]>([]);
  const [duration, setDuration] = useState<MeetingDuration>(
    MeetingDuration.NUMBER_30,
  );
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<AvailabilitySlot | null>(
    null,
  );
  const [guestName, setGuestName] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [confirmation, setConfirmation] = useState<{
    meetingTypeTitle: string;
    durationMinutes: number;
    startAt: string;
    endAt: string;
    ownerName: string;
    guestName: string;
    confirmationCode: string;
  } | null>(null);
  const [loadingOffer, setLoadingOffer] = useState(true);
  const [loadingAvailability, setLoadingAvailability] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const idempotencyKey = useRef<{ fingerprint: string; key: string } | null>(
    null,
  );

  useEffect(() => {
    let active = true;

    getMeetingTypes()
      .then((response) => {
        if (!active) return;
        if (response.status !== 200) {
          setErrorMessage('Не удалось загрузить предложение специалиста.');
          return;
        }

        const [offer] = response.data.meetingTypes;
        if (!offer) {
          setErrorMessage('Сейчас нет доступных предложений.');
          return;
        }

        setMeetingType(offer);
        setDuration(offer.durationMinutes[0] ?? MeetingDuration.NUMBER_30);
      })
      .catch(() => {
        if (active) {
          setErrorMessage(
            'Не удалось связаться с сервисом. Попробуйте обновить страницу.',
          );
        }
      })
      .finally(() => {
        if (active) setLoadingOffer(false);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!meetingType) return undefined;

    let active = true;
    const range = bookingWindow();
    setLoadingAvailability(true);

    getAvailability(
      meetingType.id,
      {
        from: range[0] ?? '',
        to: range.at(-1) ?? '',
        durationMinutes: duration,
      },
      { credentials: 'include' },
    )
      .then((response) => {
        if (!active) return;
        if (response.status !== 200) {
          setErrorMessage(
            getApiError(response.data)?.message ??
              'Не удалось загрузить свободное время.',
          );
          return;
        }

        setDates(response.data.dates);
        const firstAvailable =
          response.data.dates.find((date) => date.slots.length > 0) ?? null;
        setSelectedDate((current) =>
          current &&
          response.data.dates.some(
            (date) => date.date === current && date.slots.length > 0,
          )
            ? current
            : (firstAvailable?.date ?? null),
        );
      })
      .catch(() => {
        if (active) {
          setErrorMessage(
            'Не удалось связаться с сервисом. Попробуйте ещё раз.',
          );
        }
      })
      .finally(() => {
        if (active) setLoadingAvailability(false);
      });

    return () => {
      active = false;
    };
  }, [meetingType, duration, refreshVersion]);

  const selectedDateAvailability =
    dates.find((date) => date.date === selectedDate) ?? null;
  const selectedSlots = selectedDateAvailability?.slots ?? [];

  async function submitBooking(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!meetingType || !selectedSlot) return;

    setSubmitting(true);
    setErrorMessage(null);
    setFieldErrors({});

    try {
      const request = {
        meetingTypeId: meetingType.id,
        startAt: selectedSlot.startAt,
        durationMinutes: duration,
        guest: { name: guestName, phone: guestPhone },
      };
      const fingerprint = JSON.stringify(request);
      if (idempotencyKey.current?.fingerprint !== fingerprint) {
        idempotencyKey.current = {
          fingerprint,
          key: crypto.randomUUID(),
        };
      }

      const response = await createBooking(request, {
        headers: { 'Idempotency-Key': idempotencyKey.current.key },
      });

      if (response.status === 201) {
        setConfirmation(response.data);
        return;
      }

      const apiError = getApiError(response.data);
      if (response.status === 409 && apiError?.code === 'SLOT_UNAVAILABLE') {
        setSelectedSlot(null);
        setErrorMessage('Это время уже заняли. Выберите другое.');
        setRefreshVersion((version) => version + 1);
        return;
      }

      if (response.status === 422 && apiError?.fieldErrors) {
        setFieldErrors(apiError.fieldErrors);
      }
      setErrorMessage(
        apiError?.message ??
          'Не удалось создать бронирование. Проверьте данные и попробуйте ещё раз.',
      );
    } catch {
      setErrorMessage(
        'Не удалось связаться с сервисом. Введённые данные сохранены.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (confirmation) {
    return (
      <main className="booking-main">
        <section className="booking-card" aria-labelledby="confirmation-title">
          <Badge color="teal" variant="light">
            Бронирование подтверждено
          </Badge>
          <Title id="confirmation-title" order={1}>
            Встреча запланирована
          </Title>
          <Text>
            {confirmation.meetingTypeTitle},{' '}
            {formatDate(confirmation.startAt.slice(0, 10))},{' '}
            {formatTime(confirmation.startAt)}–{formatTime(confirmation.endAt)}.
          </Text>
          <Text>Специалист: {confirmation.ownerName}</Text>
          <Text>Клиент: {confirmation.guestName}</Text>
          <Text className="confirmation-code" role="status">
            Код бронирования: {confirmation.confirmationCode}
          </Text>
          <Text className="demo-notice">
            Это демонстрационная запись в памяти процесса. Она может исчезнуть
            после перезапуска сервера.
          </Text>
        </section>
      </main>
    );
  }

  const hasAvailableDates = dates.some((date) => date.slots.length > 0);

  return (
    <main className="booking-main">
      <section className="booking-card" aria-labelledby="booking-page-title">
        <div className="booking-heading">
          <Badge color="teal" variant="light">
            Демонстрационный режим
          </Badge>
          <Title id="booking-page-title" order={1}>
            Запись на встречу
          </Title>
          <Text c="dimmed">
            Выберите длительность, дату и удобное время для онлайн-встречи.
          </Text>
          <Text className="demo-notice" role="status">
            Данные встреч хранятся в памяти одного процесса и могут быть
            потеряны после его перезапуска. Не указывайте реальные персональные
            данные.
          </Text>
        </div>

        {loadingOffer ? (
          <Text role="status">Загружаем предложение специалиста…</Text>
        ) : meetingType ? (
          <>
            <Card className="offer-card" padding="lg">
              <Text className="eyebrow">Предложение специалиста</Text>
              <div className="profile-summary">
                <img
                  className="profile-photo"
                  src={meetingType.owner.photoUrl}
                  alt=""
                />
                <div>
                  <Title order={2}>{meetingType.owner.name}</Title>
                  <Text c="dimmed">{meetingType.owner.description}</Text>
                </div>
              </div>
              <Text className="demo-notice">
                Профиль демонстрационный и будет заменён данными владельца.
              </Text>
              <Title order={3}>{meetingType.title}</Title>
              <Text c="dimmed">{meetingType.description}</Text>
              <Text className="offer-details">
                Онлайн · {meetingType.priceKzt.toLocaleString('ru-RU')} ₸
              </Text>
              {meetingType.preparationInstructions && (
                <Text size="sm" c="dimmed">
                  Подготовка: {meetingType.preparationInstructions}
                </Text>
              )}
              <Text size="sm" c="dimmed">
                {meetingType.onlineInstructions}
              </Text>
            </Card>

            <section className="booking-step" aria-labelledby="duration-title">
              <Title id="duration-title" order={2}>
                Длительность встречи
              </Title>
              <div
                className="choice-row"
                role="group"
                aria-label="Длительность встречи"
              >
                {meetingType.durationMinutes.map((minutes) => (
                  <Button
                    key={minutes}
                    type="button"
                    variant={duration === minutes ? 'filled' : 'light'}
                    aria-pressed={duration === minutes}
                    onClick={() => {
                      setDuration(minutes);
                      setSelectedSlot(null);
                      setErrorMessage(null);
                    }}
                  >
                    {minutes} минут
                  </Button>
                ))}
              </div>
            </section>

            <section className="booking-step" aria-labelledby="date-title">
              <Title id="date-title" order={2}>
                Выберите дату
              </Title>
              <Text c="dimmed" size="sm">
                Время указано по часовому поясу специалиста ({timezone}).
              </Text>
              <div className="date-grid" role="group" aria-label="Даты встречи">
                {dates.map((date) => (
                  <Button
                    key={date.date}
                    type="button"
                    variant={selectedDate === date.date ? 'filled' : 'light'}
                    disabled={loadingAvailability || date.slots.length === 0}
                    aria-pressed={selectedDate === date.date}
                    aria-label={formatDate(date.date)}
                    onClick={() => {
                      setSelectedDate(date.date);
                      setSelectedSlot(null);
                      setErrorMessage(null);
                      setFieldErrors((current) => ({
                        ...current,
                        startAt: '',
                      }));
                    }}
                  >
                    {formatDate(date.date)}
                  </Button>
                ))}
              </div>
            </section>

            {loadingAvailability ? (
              <Text role="status">Загружаем свободное время…</Text>
            ) : !hasAvailableDates ? (
              <Text className="booking-empty" role="status">
                В ближайшие 14 дней свободного времени нет, попробуйте позже.
              </Text>
            ) : selectedDateAvailability ? (
              <section className="booking-step" aria-labelledby="time-title">
                <Title id="time-title" order={2}>
                  Выберите время
                </Title>
                <div
                  className="choice-row time-grid"
                  role="group"
                  aria-label="Свободное время"
                >
                  {selectedSlots.map((slot) => (
                    <Button
                      key={slot.startAt}
                      type="button"
                      variant={
                        selectedSlot?.startAt === slot.startAt
                          ? 'filled'
                          : 'light'
                      }
                      aria-pressed={selectedSlot?.startAt === slot.startAt}
                      onClick={() => {
                        setSelectedSlot(slot);
                        setErrorMessage(null);
                        setFieldErrors((current) => ({
                          ...current,
                          startAt: '',
                        }));
                      }}
                    >
                      {formatTime(slot.startAt)}
                    </Button>
                  ))}
                </div>
              </section>
            ) : null}

            {selectedSlot && (
              <Text className="selection-summary" role="status">
                Выбрано время: {formatDate(selectedSlot.startAt.slice(0, 10))},{' '}
                {formatTime(selectedSlot.startAt)} · {duration} минут
              </Text>
            )}
            {fieldErrors.startAt && (
              <Text className="form-error" role="alert">
                {fieldErrors.startAt}
              </Text>
            )}

            <form className="booking-form" onSubmit={submitBooking}>
              <Title order={2}>Ваши данные</Title>
              <TextInput
                label="Имя"
                name="name"
                autoComplete="name"
                required
                maxLength={120}
                error={fieldErrors['guest.name']}
                value={guestName}
                onChange={(event) => {
                  setGuestName(event.currentTarget.value);
                  setFieldErrors((current) => ({
                    ...current,
                    'guest.name': '',
                  }));
                }}
              />
              <TextInput
                label="Телефон"
                name="phone"
                type="tel"
                autoComplete="tel"
                required
                placeholder="+7 700 123 45 67"
                error={fieldErrors['guest.phone']}
                value={guestPhone}
                onChange={(event) => {
                  setGuestPhone(event.currentTarget.value);
                  setFieldErrors((current) => ({
                    ...current,
                    'guest.phone': '',
                  }));
                }}
              />
              <Text c="dimmed" size="sm">
                Имя и телефон передаются владельцу для проведения встречи.
              </Text>
              {errorMessage && (
                <Text className="form-error" role="alert">
                  {errorMessage}
                </Text>
              )}
              <Button
                type="submit"
                className="primary-action"
                disabled={
                  !selectedSlot ||
                  submitting ||
                  loadingAvailability ||
                  !hasAvailableDates
                }
                loading={submitting}
              >
                Подтвердить бронирование
              </Button>
            </form>
          </>
        ) : (
          errorMessage && (
            <Text className="form-error" role="alert">
              {errorMessage}
            </Text>
          )
        )}

        <Text className="booking-disclaimer" c="dimmed" size="sm">
          Демо-бронирование хранится в памяти API и может исчезнуть после
          перезапуска сервера.
        </Text>
      </section>
    </main>
  );
}

function OwnerPage() {
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [bookings, setBookings] = useState<OwnerBooking[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function loadBookings() {
    setLoading(true);
    setErrorMessage(null);

    try {
      const response = await getOwnerBookings({ credentials: 'include' });

      if (response.status === 200) {
        setBookings(response.data.bookings);
      } else if (response.status === 401) {
        setBookings(null);
      } else {
        setErrorMessage('Не удалось загрузить встречи.');
      }
    } catch {
      setErrorMessage('Не удалось связаться с сервисом. Попробуйте ещё раз.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadBookings();
  }, []);

  async function submitLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setErrorMessage(null);

    try {
      const response = await createOwnerSession(
        { login, password },
        { credentials: 'include' },
      );

      if (response.status === 204) {
        setPassword('');
        await loadBookings();
      } else {
        const apiError = getApiError(response.data);
        setErrorMessage(
          apiError?.message ??
            'Не удалось войти. Проверьте данные и попробуйте ещё раз.',
        );
      }
    } catch {
      setErrorMessage('Не удалось связаться с сервисом. Попробуйте ещё раз.');
    } finally {
      setSubmitting(false);
    }
  }

  async function logout() {
    try {
      await deleteOwnerSession({ credentials: 'include' });
      setBookings(null);
    } catch {
      setErrorMessage('Не удалось завершить сеанс. Попробуйте ещё раз.');
    }
  }

  return (
    <main className="booking-main">
      <section
        className="booking-card owner-card"
        aria-labelledby="owner-title"
      >
        <Text className="eyebrow">Личный раздел</Text>
        <Title id="owner-title" order={1}>
          Встречи владельца
        </Title>
        {loading ? (
          <Text role="status">Проверяем доступ…</Text>
        ) : bookings === null ? (
          <form className="booking-form" onSubmit={submitLogin}>
            <TextInput
              label="Логин"
              name="login"
              autoComplete="username"
              required
              value={login}
              onChange={(event) => setLogin(event.currentTarget.value)}
            />
            <TextInput
              label="Пароль"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.currentTarget.value)}
            />
            {errorMessage && (
              <Text className="form-error" role="alert">
                {errorMessage}
              </Text>
            )}
            <Button type="submit" loading={submitting}>
              Войти
            </Button>
          </form>
        ) : (
          <>
            <div className="owner-heading">
              <Text c="dimmed">Будущие встречи · {timezone}</Text>
              <Button type="button" variant="light" onClick={logout}>
                Выйти
              </Button>
            </div>
            {bookings.length === 0 ? (
              <Text className="booking-empty" role="status">
                Пока нет предстоящих встреч.
              </Text>
            ) : (
              <div className="owner-bookings">
                {bookings.map((booking) => (
                  <Card
                    className="owner-booking"
                    key={booking.confirmationCode}
                    padding="lg"
                  >
                    <Title order={2}>{booking.meetingTypeTitle}</Title>
                    <Text>
                      {formatDate(booking.startAt.slice(0, 10))},{' '}
                      {formatTime(booking.startAt)}–{formatTime(booking.endAt)}
                    </Text>
                    <Text>Клиент: {booking.guestName}</Text>
                    <Text>Телефон: {booking.guestPhone}</Text>
                    <Text>Код: {booking.confirmationCode}</Text>
                  </Card>
                ))}
              </div>
            )}
            {errorMessage && (
              <Text className="form-error" role="alert">
                {errorMessage}
              </Text>
            )}
          </>
        )}
      </section>
    </main>
  );
}

export function App() {
  const path = window.location.pathname;

  return (
    <MantineProvider defaultColorScheme="light">
      <div className="workspace">
        <Header />
        {path === '/booking' ? (
          <BookingPage />
        ) : path === '/owner' ? (
          <OwnerPage />
        ) : (
          <HomePage />
        )}
        <footer className="footer">
          <Text size="xs" c="dimmed">
            Meetly — демонстрационный сервис
          </Text>
        </footer>
      </div>
    </MantineProvider>
  );
}
