import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { setTimeout as delay } from 'node:timers/promises';

const portProbe = createServer();
await new Promise((resolve, reject) => {
  portProbe.once('error', reject);
  portProbe.listen(0, '127.0.0.1', resolve);
});

const address = portProbe.address();
if (!address || typeof address === 'string') {
  throw new Error('Could not determine a free port for the API smoke test');
}
await new Promise((resolve, reject) => {
  portProbe.close((error) => (error ? reject(error) : resolve()));
});

const child = spawn(process.execPath, ['apps/api/dist/server.js'], {
  env: { ...process.env, PORT: String(address.port) },
  stdio: 'inherit',
});

let childError;
child.on('error', (error) => {
  childError = error;
});

try {
  const deadline = Date.now() + 10_000;
  let lastError;
  let passed = false;

  while (Date.now() < deadline) {
    if (childError) throw childError;
    if (child.exitCode !== null) {
      throw new Error(`API server exited with code ${child.exitCode}`);
    }

    let response;
    try {
      response = await fetch(`http://127.0.0.1:${address.port}/health`);
    } catch (error) {
      lastError = error;
      await delay(100);
      continue;
    }

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { status: 'ok' });
    console.log('API smoke test passed: GET /health returned { status: "ok" }');
    passed = true;
    break;
  }

  if (!passed) {
    throw new Error('API did not become ready for the smoke test', {
      cause: lastError,
    });
  }
} finally {
  if (child.exitCode === null) {
    child.kill('SIGTERM');
    await Promise.race([
      new Promise((resolve) => child.once('exit', resolve)),
      delay(3_000),
    ]);
    if (child.exitCode === null && child.signalCode === null) {
      child.kill('SIGKILL');
    }
  }
}
