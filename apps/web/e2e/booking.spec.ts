import { expect, test } from '@playwright/test';

test('guest books a slot and the owner sees the meeting', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Выбрать встречу' }).click();
  await expect(
    page.getByRole('heading', { name: 'Запись на встречу' }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Демонстрационная онлайн-консультация' }),
  ).toBeVisible();

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
  await page.getByRole('textbox', { name: /Логин/ }).fill('e2e-owner');
  await page.getByLabel(/Пароль/).fill('e2e-password');
  await page.getByRole('button', { name: 'Войти' }).click();

  await expect(page.getByText('Клиент: E2E Гость')).toBeVisible();
  await expect(page.getByText('+77001234567')).toBeVisible();
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
