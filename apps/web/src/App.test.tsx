// @vitest-environment jsdom

import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './App.js';

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
    expect(
      screen.getByText(/каталог и полноценная запись пока в разработке/i),
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
        name: 'Как можно будет выбрать встречу',
      }),
    ).toBeTruthy();
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
    expect(
      screen.getByRole('heading', {
        level: 2,
        name: 'Встречи от специалистов',
      }),
    ).toBeTruthy();
  });

  it('has one client call to action that leads to the booking page', () => {
    render(<App />);

    const callsToAction = screen.getAllByRole('link', {
      name: 'Выбрать встречу',
    });
    expect(callsToAction).toHaveLength(1);
    expect(callsToAction[0].getAttribute('href')).toBe('/booking');
  });

  it('shows an honest booking placeholder without a booking form', () => {
    window.history.replaceState({}, '', '/booking');

    render(<App />);

    expect(
      screen.getByRole('heading', {
        level: 1,
        name: 'Каталог встреч и запись',
      }),
    ).toBeTruthy();
    expect(
      screen.getByText(
        /каталог встреч и полноценная запись пока в разработке/i,
      ),
    ).toBeTruthy();
    expect(screen.getByText(/завершить бронирование нельзя/i)).toBeTruthy();
    expect(screen.queryByRole('form')).toBeNull();
    expect(
      screen
        .getByRole('link', { name: 'Вернуться на главную' })
        .getAttribute('href'),
    ).toBe('/');
  });
});
