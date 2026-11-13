import { buildApp, readApiConfigFromEnv } from './app.js';

try {
  const app = buildApp(readApiConfigFromEnv());

  await app.listen({
    host: '0.0.0.0',
    port: Number(process.env.PORT ?? 3000),
  });
} catch (error) {
  console.error('Failed to start the API server', error);
  process.exitCode = 1;
}
