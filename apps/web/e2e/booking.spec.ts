import { expect, test } from '@playwright/test';

test('guest books a slot and the owner sees the meeting', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/owner');
  await page.getByRole('textbox', { name: /Логин/ }).fill('e2e-owner');
  await page.getByLabel(/Пароль/).fill('e2e-password');
  await page.getByRole('button', { name: 'Войти' }).click();
  await page
    .getByRole('textbox', { name: 'Название типа встречи' })
    .fill('Демонстрационная онлайн-консультация');
  await page
    .getByRole('textbox', { name: 'Описание' })
    .fill('Индивидуальная онлайн-встреча.');
  await page.getByRole('checkbox', { name: '45 минут' }).check();
  await page.getByRole('button', { name: 'Создать тип встречи' }).click();
  await expect(
    page.getByText('Тип встречи создан и доступен гостям.'),
  ).toBeVisible();

  await page.goto('/');
  await page.getByRole('link', { name: 'Выбрать встречу' }).click();
  await expect(
    page.getByRole('heading', { name: 'Запись на встречу' }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Демонстрационная онлайн-консультация' }),
  ).toBeVisible();
  const profileText = page.locator('.profile-summary > div');
  await expect(profileText).toBeVisible();
  const profileSize = await profileText.evaluate((element) => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
  }));
  expect(profileSize.scrollWidth).toBeLessThanOrEqual(profileSize.clientWidth);

  await page
    .getByRole('group', { name: 'Длительность встречи' })
    .getByRole('button', { name: '45 минут' })
    .click();
  const calendar = page.getByRole('group', { name: 'Даты встречи' });
  await expect(calendar.getByRole('button').first()).toBeVisible();
  await calendar.getByRole('button').first().waitFor();
  const availableDate = calendar.locator('button:not([disabled])').first();
  await expect(availableDate).toBeEnabled();
  await availableDate.click();

  await page
    .getByRole('group', { name: 'Свободное время' })
    .getByRole('button')
    .first()
    .click();
  await page.getByRole('textbox', { name: /Имя/ }).fill('E2E Гость');
  await page.getByRole('textbox', { name: /Телефон/ }).fill('+7 700 123 45 67');
  await page.getByRole('button', { name: 'Подтвердить бронирование' }).click();

  await expect(
    page.getByRole('heading', { name: 'Встреча запланирована' }),
  ).toBeVisible();
  await expect(page.getByText(/^Клиент: E2E Гость$/)).toBeVisible();
  await expect(page.getByText(/^Код бронирования: MLY-/)).toBeVisible();

  await page.goto('/owner');

  await expect(page.getByText('Клиент: E2E Гость')).toBeVisible();
  await expect(page.getByText('+77001234567')).toBeVisible();
});

test('owner creates a type guests can select and overlapping bookings conflict across types', async ({
  browser,
  page,
}) => {
  await page.goto('/owner');
  await page.getByRole('textbox', { name: /Логин/ }).fill('e2e-owner');
  await page.getByLabel(/Пароль/).fill('e2e-password');
  await page.getByRole('button', { name: 'Войти' }).click();
  await page
    .getByRole('textbox', { name: 'Название типа встречи' })
    .fill('Первый тип');
  await page
    .getByRole('textbox', { name: 'Описание' })
    .fill('Описание первого типа встречи.');
  await page.getByRole('button', { name: 'Создать тип встречи' }).click();
  await expect(
    page.getByText('Тип встречи создан и доступен гостям.'),
  ).toBeVisible();
  await page
    .getByRole('textbox', { name: 'Название типа встречи' })
    .fill('Второй тип');
  await page
    .getByRole('textbox', { name: 'Описание' })
    .fill('Описание второго типа встречи.');
  await page.getByRole('button', { name: 'Создать тип встречи' }).click();
  await expect(
    page.getByText('Тип встречи создан и доступен гостям.'),
  ).toBeVisible();

  const secondContext = await browser.newContext();
  const secondPage = await secondContext.newPage();

  try {
    await Promise.all([page.goto('/booking'), secondPage.goto('/booking')]);
    await page
      .getByRole('group', { name: 'Тип встречи' })
      .getByRole('button', { name: 'Первый тип' })
      .click();
    await secondPage
      .getByRole('group', { name: 'Тип встречи' })
      .getByRole('button', { name: 'Второй тип' })
      .click();

    const firstCalendar = page.getByRole('group', { name: 'Даты встречи' });
    const firstDate = firstCalendar.locator('button:not([disabled])').first();
    const dateLabel = await firstDate.getAttribute('aria-label');
    await firstDate.click();
    const secondCalendar = secondPage.getByRole('group', {
      name: 'Даты встречи',
    });
    await secondCalendar.getByRole('button', { name: dateLabel ?? '' }).click();

    await Promise.all([
      page
        .getByRole('group', { name: 'Свободное время' })
        .getByRole('button', { name: '10:00' })
        .click(),
      secondPage
        .getByRole('group', { name: 'Свободное время' })
        .getByRole('button', { name: '10:00' })
        .click(),
    ]);

    await page.getByRole('textbox', { name: /Имя/ }).fill('Гость Один');
    await page
      .getByRole('textbox', { name: /Телефон/ })
      .fill('+7 700 111 22 33');
    await secondPage.getByRole('textbox', { name: /Имя/ }).fill('Гость Два');
    await secondPage
      .getByRole('textbox', { name: /Телефон/ })
      .fill('+7 700 222 33 44');

    await Promise.all([
      page.getByRole('button', { name: 'Подтвердить бронирование' }).click(),
      secondPage
        .getByRole('button', { name: 'Подтвердить бронирование' })
        .click(),
    ]);

    await expect
      .poll(async () => {
        const firstConfirmed = await page
          .getByRole('heading', { name: 'Встреча запланирована' })
          .count();
        const secondConfirmed = await secondPage
          .getByRole('heading', { name: 'Встреча запланирована' })
          .count();

        return firstConfirmed + secondConfirmed;
      })
      .toBe(1);
    const firstConflict = page.getByRole('alert').filter({
      hasText: 'Это время уже заняли. Выберите другое.',
    });
    const secondConflict = secondPage.getByRole('alert').filter({
      hasText: 'Это время уже заняли. Выберите другое.',
    });
    await expect
      .poll(
        async () =>
          (await firstConflict.count()) + (await secondConflict.count()),
      )
      .toBe(1);
  } finally {
    await secondContext.close();
  }
});

test('concurrent guests see a conflict without losing their form data', async ({
  browser,
  baseURL,
}) => {
  const firstContext = await browser.newContext({
    baseURL: baseURL ?? 'http://127.0.0.1:4173',
  });
  const secondContext = await browser.newContext({
    baseURL: baseURL ?? 'http://127.0.0.1:4173',
  });
  const firstPage = await firstContext.newPage();
  const secondPage = await secondContext.newPage();

  try {
    await Promise.all([
      firstPage.goto('/booking'),
      secondPage.goto('/booking'),
    ]);

    const firstCalendar = firstPage.getByRole('group', {
      name: 'Даты встречи',
    });
    const firstAvailableDate = firstCalendar
      .locator('button:not([disabled])')
      .first();
    const dateLabel = await firstAvailableDate.getAttribute('aria-label');
    await firstAvailableDate.click();
    await secondPage
      .getByRole('group', { name: 'Даты встречи' })
      .getByRole('button', { name: dateLabel ?? '' })
      .click();

    await Promise.all([
      firstPage
        .getByRole('group', { name: 'Свободное время' })
        .getByRole('button')
        .first()
        .click(),
      secondPage
        .getByRole('group', { name: 'Свободное время' })
        .getByRole('button')
        .first()
        .click(),
    ]);

    await firstPage.getByRole('textbox', { name: /Имя/ }).fill('Гость Один');
    await firstPage
      .getByRole('textbox', { name: /Телефон/ })
      .fill('+7 700 111 22 33');
    await secondPage.getByRole('textbox', { name: /Имя/ }).fill('Гость Два');
    await secondPage
      .getByRole('textbox', { name: /Телефон/ })
      .fill('+7 700 222 33 44');

    await Promise.all([
      firstPage
        .getByRole('button', { name: 'Подтвердить бронирование' })
        .click(),
      secondPage
        .getByRole('button', { name: 'Подтвердить бронирование' })
        .click(),
    ]);

    await expect
      .poll(async () => {
        const firstConfirmed = await firstPage
          .getByRole('heading', { name: 'Встреча запланирована' })
          .count();
        const secondConfirmed = await secondPage
          .getByRole('heading', { name: 'Встреча запланирована' })
          .count();

        return firstConfirmed + secondConfirmed;
      })
      .toBe(1);
    const firstConfirmed =
      (await firstPage
        .getByRole('heading', { name: 'Встреча запланирована' })
        .count()) === 1;
    const conflictPage = firstConfirmed ? secondPage : firstPage;

    await expect(
      conflictPage.getByRole('alert').filter({
        hasText: 'Это время уже заняли. Выберите другое.',
      }),
    ).toBeVisible();
    await expect(
      conflictPage.getByRole('textbox', { name: /Имя/ }),
    ).toHaveValue(conflictPage === firstPage ? 'Гость Один' : 'Гость Два');
    await expect(
      conflictPage.getByRole('textbox', { name: /Телефон/ }),
    ).toHaveValue(
      conflictPage === firstPage ? '+7 700 111 22 33' : '+7 700 222 33 44',
    );
  } finally {
    await firstContext.close();
    await secondContext.close();
  }
});
