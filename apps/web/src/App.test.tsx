// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './App.js';

const api = vi.hoisted(() => ({
  createBooking: vi.fn(),
  createOwnerSession: vi.fn(),
  deleteOwnerSession: vi.fn(),
  getAvailability: vi.fn(),
  getMeetingTypes: vi.fn(),
  getOwnerBookings: vi.fn(),
}));

vi.mock('@project/api-client/src/generated/api.js', () => ({
  ...api,
  MeetingDuration: {
    NUMBER_30: 30,
    NUMBER_45: 45,
    NUMBER_60: 60,
  },
}));

const meetingType = {
  id: 'online-consultation',
  title: 'Демонстрационная онлайн-консультация',
  description: 'Индивидуальная онлайн-встреча.',
  durationMinutes: [30, 45, 60],
  onlineInstructions: 'Подключение онлайн.',
  priceKzt: 5000,
  owner: {
    name: 'Демонстрационный специалист',
    description: 'Демонстрационный профиль из двух предложений.',
    photoUrl: '/demo-specialist.svg',
  },
};

function createAvailability(from: string, to: string, withSlots = true) {
  const [year, month, day] = from.split('-').map(Number);
  const first = new Date(Date.UTC(year, month - 1, day));
  const days = Array.from({ length: 14 }, (_, index) => {
    const date = new Date(first);
    date.setUTCDate(date.getUTCDate() + index);
    const dateKey = date.toISOString().slice(0, 10);

    return {
      date: dateKey,
      slots:
        withSlots && index === 0
          ? [
              {
                startAt: `${dateKey}T09:00:00+05:00`,
                endAt: `${dateKey}T09:30:00+05:00`,
              },
            ]
          : [],
    };
  });

  return {
    timeZone: 'Asia/Almaty',
    from,
    to,
    dates: days,
  };
}

beforeEach(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockReturnValue({
      matches: false,
      media: '',
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }),
  });

  api.createBooking.mockReset();
  api.createOwnerSession.mockReset();
  api.deleteOwnerSession.mockReset();
  api.getAvailability.mockReset();
  api.getMeetingTypes.mockReset();
  api.getOwnerBookings.mockReset();
  api.getMeetingTypes.mockResolvedValue({
    status: 200,
    data: { meetingTypes: [meetingType] },
  });
  api.getAvailability.mockImplementation(
    (_meetingTypeId: string, params: { from: string; to: string }) =>
      Promise.resolve({
        status: 200,
        data: createAvailability(params.from, params.to),
      }),
  );
});

afterEach(() => {
  cleanup();
  window.history.replaceState({}, '', '/');
});

describe('Meetly homepage', () => {
  it('explains the service and its client benefits', () => {
    render(<App />);

    expect(
      screen.getByRole('heading', {
        level: 1,
        name: 'Встречи и консультации от специалистов',
      }),
    ).toBeTruthy();

    const benefits = screen.getByRole('region', {
      name: 'Выбирать будет проще',
    });
    expect(
      within(benefits).getByText('Предложения в одном месте'),
    ).toBeTruthy();
    expect(
      within(benefits).getByText('Понятно о формате заранее'),
    ).toBeTruthy();
    expect(within(benefits).getByText('Удобный выбор')).toBeTruthy();
    expect(
      screen.getByRole('heading', {
        level: 2,
        name: 'Как выбрать встречу',
      }),
    ).toBeTruthy();
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
  });

  it('has a client call to action that leads to the booking page', () => {
    render(<App />);

    expect(
      screen
        .getByRole('link', { name: 'Выбрать встречу' })
        .getAttribute('href'),
    ).toBe('/booking');
  });
});

describe('booking page', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', '/booking');
  });

  it('loads real availability, lets a client choose a time, and confirms a booking', async () => {
    api.createBooking.mockResolvedValue({
      status: 201,
      data: {
        meetingTypeTitle: meetingType.title,
        durationMinutes: 45,
        startAt: '2026-11-11T09:00:00+05:00',
        endAt: '2026-11-11T09:45:00+05:00',
        ownerName: meetingType.owner.name,
        guestName: 'Алексей Клиент',
        confirmationCode: 'MLY-1234ABCD',
      },
    });

    render(<App />);

    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: 'Запись на встречу',
      }),
    ).toBeTruthy();
    expect(screen.getByText(meetingType.title)).toBeTruthy();

    const durationGroup = screen.getByRole('group', {
      name: 'Длительность встречи',
    });
    fireEvent.click(
      within(durationGroup).getByRole('button', { name: '45 минут' }),
    );
    await waitFor(() => {
      expect(api.getAvailability).toHaveBeenLastCalledWith(
        meetingType.id,
        expect.objectContaining({ durationMinutes: 45 }),
        { credentials: 'include' },
      );
    });

    const calendar = await screen.findByRole('group', {
      name: 'Даты встречи',
    });
    const availableDate = within(calendar)
      .getAllByRole('button')
      .find((button) => !button.hasAttribute('disabled'));
    if (!availableDate) {
      throw new Error('Expected an available date in the API response');
    }
    fireEvent.click(availableDate);
    fireEvent.click(await screen.findByRole('button', { name: '09:00' }));
    fireEvent.change(screen.getByRole('textbox', { name: /Имя/ }), {
      target: { value: 'Алексей Клиент' },
    });
    fireEvent.change(screen.getByRole('textbox', { name: /Телефон/ }), {
      target: { value: '+7 700 123 45 67' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'Подтвердить бронирование' }),
    );

    expect(
      await screen.findByRole('heading', {
        name: 'Встреча запланирована',
      }),
    ).toBeTruthy();
    expect(screen.getByText(/MLY-1234ABCD/)).toBeTruthy();
    expect(api.createBooking).toHaveBeenCalledWith(
      expect.objectContaining({
        meetingTypeId: meetingType.id,
        durationMinutes: 45,
        guest: { name: 'Алексей Клиент', phone: '+7 700 123 45 67' },
      }),
      expect.objectContaining({
        headers: { 'Idempotency-Key': expect.any(String) },
      }),
    );
  });

  it('shows no availability and disables submission when the API returns no slots', async () => {
    api.getAvailability.mockImplementation(
      (_meetingTypeId: string, params: { from: string; to: string }) =>
        Promise.resolve({
          status: 200,
          data: createAvailability(params.from, params.to, false),
        }),
    );

    render(<App />);

    expect(
      await screen.findByText(
        'В ближайшие 14 дней свободного времени нет, попробуйте позже.',
      ),
    ).toBeTruthy();
    expect(
      screen
        .getByRole('button', { name: 'Подтвердить бронирование' })
        .hasAttribute('disabled'),
    ).toBe(true);
    expect(api.createBooking).not.toHaveBeenCalled();
  });

  it('refreshes availability after a slot conflict and keeps form data', async () => {
    api.getAvailability
      .mockImplementationOnce(
        (_meetingTypeId: string, params: { from: string; to: string }) =>
          Promise.resolve({
            status: 200,
            data: createAvailability(params.from, params.to),
          }),
      )
      .mockImplementationOnce(
        (_meetingTypeId: string, params: { from: string; to: string }) =>
          Promise.resolve({
            status: 200,
            data: createAvailability(params.from, params.to, false),
          }),
      );
    api.createBooking.mockResolvedValue({
      status: 409,
      data: {
        code: 'SLOT_UNAVAILABLE',
        message: 'Это время уже заняли. Выберите другое.',
      },
    });

    render(<App />);

    fireEvent.click(await screen.findByRole('button', { name: '09:00' }));
    fireEvent.change(screen.getByRole('textbox', { name: /Имя/ }), {
      target: { value: 'Сохранённое имя' },
    });
    fireEvent.change(screen.getByRole('textbox', { name: /Телефон/ }), {
      target: { value: '+7 700 111 22 33' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'Подтвердить бронирование' }),
    );

    expect(
      await screen.findByText('Это время уже заняли. Выберите другое.'),
    ).toBeTruthy();
    expect(screen.getByRole('textbox', { name: /Имя/ })).toHaveProperty(
      'value',
      'Сохранённое имя',
    );
    expect(screen.getByRole('textbox', { name: /Телефон/ })).toHaveProperty(
      'value',
      '+7 700 111 22 33',
    );
    expect(api.getAvailability).toHaveBeenCalledTimes(2);
  });
});

describe('owner page', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', '/owner');
  });

  it('lets the owner sign in and view future bookings', async () => {
    api.getOwnerBookings
      .mockResolvedValueOnce({
        status: 401,
        data: { code: 'UNAUTHENTICATED', message: 'Войдите.' },
      })
      .mockResolvedValueOnce({
        status: 200,
        data: {
          timeZone: 'Asia/Almaty',
          bookings: [
            {
              meetingTypeTitle: meetingType.title,
              startAt: '2026-11-11T09:00:00+05:00',
              endAt: '2026-11-11T09:30:00+05:00',
              guestName: 'Алексей Клиент',
              guestPhone: '+77001234567',
              confirmationCode: 'MLY-1234ABCD',
            },
          ],
        },
      });
    api.createOwnerSession.mockResolvedValue({ status: 204 });

    render(<App />);

    fireEvent.change(await screen.findByRole('textbox', { name: /Логин/ }), {
      target: { value: 'owner' },
    });
    fireEvent.change(screen.getByLabelText(/Пароль/), {
      target: { value: 'secret' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Войти' }));

    expect(await screen.findByText('Клиент: Алексей Клиент')).toBeTruthy();
    expect(api.createOwnerSession).toHaveBeenCalledWith(
      { login: 'owner', password: 'secret' },
      { credentials: 'include' },
    );
    expect(api.getOwnerBookings).toHaveBeenCalledTimes(2);
  });
});

it('provides booking page under the expected route', async () => {
  window.history.replaceState({}, '', '/booking');

  render(
    <MantineProvider>
      <App />
    </MantineProvider>,
  );

  expect(
    await screen.findByRole('heading', { name: 'Запись на встречу' }),
  ).toBeTruthy();
});
