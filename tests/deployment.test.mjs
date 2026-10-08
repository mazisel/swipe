import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../server/app.mjs';

test('readiness checks database availability, recovers, and does not disclose errors', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'swipe-ready-'));
  const { app, db } = await createApp({ dbPath: ':memory:', databaseUrl: undefined, uploadDir: dir, seed: false });
  const server = await new Promise(resolve => {
    const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
  });
  const url = `http://127.0.0.1:${server.address().port}/api/ready`;
  const query = db.query;
  try {
    let response = await fetch(url);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.deepEqual(await response.json(), { ok: true });
    db.query = async () => { throw new Error('private database connection details'); };
    response = await fetch(url);
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), { ok: false });
    db.query = query;
    // Health probes must not exhaust the public request quota or become unhealthy.
    for (let i = 0; i < 185; i++) assert.equal((await fetch(url)).status, 200);
    assert.equal((await fetch(url.replace('/ready', '/health'))).status, 200);
  } finally {
    db.query = query;
    await new Promise(resolve => server.close(resolve));
    await db.close();
    await rm(dir, { recursive: true, force: true });
  }
});
