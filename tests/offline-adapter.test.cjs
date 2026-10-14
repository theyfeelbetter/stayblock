'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { fixtures } = require('./support/offline-fixtures.cjs');

test('client defaults to disabled and never accesses browser storage or network', async () => {
  const { createApiAdapter } = await import('../client/api-adapter.mjs');
  let calls = 0;
  const fetchImpl = async () => { calls++; throw new Error('unexpected network'); };
  for (const options of [{}, { enabled: true, origin: 'https://public.example' }]) {
    await assert.rejects(createApiAdapter({ ...options, fetchImpl }).session(), { status: 501, code: 'NOT_CONFIGURED' });
  }
  assert.equal(calls, 0);
});
test('public browser cannot enable local adapter and no browser storage is touched', async () => {
  const { createApiAdapter } = await import('../client/api-adapter.mjs');
  const location = Object.getOwnPropertyDescriptor(globalThis, 'location');
  const storage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  let calls = 0;
  try {
    Object.defineProperty(globalThis, 'location', { configurable: true, value: { origin: 'https://public.example' } });
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { throw new Error('STORAGE_ACCESS'); } });
    await assert.rejects(createApiAdapter({ enabled: true, origin: 'http://127.0.0.1:8787',
      fetchImpl: async () => { calls++; } }).session(), { status: 501 });
    assert.equal(calls, 0);
  } finally {
    if (location) Object.defineProperty(globalThis, 'location', location); else delete globalThis.location;
    if (storage) Object.defineProperty(globalThis, 'localStorage', storage); else delete globalThis.localStorage;
  }
});
test('explicit local adapter propagates 501/network failures with no silent fallback', async () => {
  const { createApiAdapter } = await import('../client/api-adapter.mjs');
  const options = { enabled: true, origin: 'http://127.0.0.1:8787' };
  const adapter = createApiAdapter({ ...options, fetchImpl: async () => new Response(JSON.stringify({ code: 'NOT_CONFIGURED' }),
    { status: 501, headers: { 'content-type': 'application/json' } }) });
  await assert.rejects(adapter.session(), { status: 501, code: 'NOT_CONFIGURED' });
  const down = createApiAdapter({ ...options, fetchImpl: async () => { throw new Error('NETWORK_DOWN'); } });
  await assert.rejects(down.reservations('synthetic-host'), /NETWORK_DOWN/);
});
test('adapter session/read path exercises same API dispatcher with synthetic cookie transport', async () => {
  const { createApiAdapter, calendarRows } = await import('../client/api-adapter.mjs');
  const f = fixtures();
  await f.request('a', 'POST', `/api/hosts/${f.ids.ha}/reservations`, f.reservation);
  const adapter = createApiAdapter({ enabled: true, origin: 'http://127.0.0.1:8787', fetchImpl: async (url, options) => {
    assert.equal(options.credentials, 'same-origin'); assert.equal(options.redirect, 'error');
    const response = await f.request('a', options.method, new URL(url).pathname, undefined, options.headers);
    return new Response(JSON.stringify(response.body), { status: response.status, headers: response.headers });
  } });
  const rows = calendarRows(await adapter.reservations(f.ids.ha), [...f.tables.rooms.values()]);
  assert.equal(rows[0].roomId, f.ids.ra); assert.equal(rows[0].cin, '2026-10-20');
  assert.equal(rows[0].amount, 10000); assert.equal((await adapter.session()).mode, 'test');
  assert.throws(() => calendarRows([...f.tables.reservations.values()], [f.tables.rooms.get(f.ids.rb)]), /UNMAPPED_ROOM/);
});
