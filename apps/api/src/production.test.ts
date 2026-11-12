import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { buildApp } from './app.js';

describe('production web hosting', () => {
  let staticRoot: string | undefined;

  afterEach(async () => {
    if (staticRoot) {
      await rm(staticRoot, { recursive: true, force: true });
      staticRoot = undefined;
    }
  });

  it('serves static assets and falls back to the SPA outside API routes', async () => {
    staticRoot = await mkdtemp(join(tmpdir(), 'meetly-web-'));
    await writeFile(join(staticRoot, 'index.html'), '<main>Meetly</main>');
    await writeFile(join(staticRoot, 'app.js'), 'globalThis.meetly = true;');

    const app = buildApp({
      ownerLogin: 'test-owner',
      ownerPassword: 'test-password',
      isProduction: true,
      staticRoot,
    });

    try {
      const page = await app.inject({ method: 'GET', url: '/owner' });
      const asset = await app.inject({ method: 'GET', url: '/app.js' });

      expect(page.statusCode).toBe(200);
      expect(page.headers['content-type']).toContain('text/html');
      expect(page.body).toContain('<main>Meetly</main>');
      expect(asset.statusCode).toBe(200);
      expect(asset.body).toBe('globalThis.meetly = true;');
    } finally {
      await app.close();
    }
  });

  it('keeps unknown API and non-GET routes as JSON 404 responses', async () => {
    staticRoot = await mkdtemp(join(tmpdir(), 'meetly-web-'));
    await writeFile(join(staticRoot, 'index.html'), '<main>Meetly</main>');

    const app = buildApp({
      ownerLogin: 'test-owner',
      ownerPassword: 'test-password',
      isProduction: true,
      staticRoot,
    });

    try {
      const unknownApi = await app.inject({
        method: 'GET',
        url: '/api/missing?source=test',
      });
      const unknownApiRoot = await app.inject({
        method: 'GET',
        url: '/api?source=test',
      });
      const nonGet = await app.inject({ method: 'POST', url: '/missing' });

      for (const response of [unknownApi, unknownApiRoot, nonGet]) {
        expect(response.statusCode).toBe(404);
        expect(response.headers['content-type']).toContain('application/json');
        expect(response.json()).toMatchObject({ code: 'NOT_FOUND' });
      }
    } finally {
      await app.close();
    }
  });
});
