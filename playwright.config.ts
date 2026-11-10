import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './apps/web/e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: 'http://127.0.0.1:4173',
    browserName: 'chromium',
    headless: true,
  },
  webServer: [
    {
      command:
        'OWNER_LOGIN=e2e-owner OWNER_PASSWORD=e2e-password npm run dev:api',
      url: 'http://127.0.0.1:3000/health',
      reuseExistingServer: false,
      timeout: 30_000,
    },
    {
      command:
        'npm run dev --workspace=@project/web -- --host 127.0.0.1 --port 4173 --strictPort',
      url: 'http://127.0.0.1:4173',
      reuseExistingServer: false,
      timeout: 30_000,
    },
  ],
});
