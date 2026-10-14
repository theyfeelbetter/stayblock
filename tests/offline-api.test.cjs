'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { createApp, COOKIE, LOCAL_ORIGIN } = require('../bff/app.cjs');
const { fixtures } = require('./support/offline-fixtures.cjs');
const pathFor = (f, host = 'ha', kind = 'reservations', id = '') => `/api/hosts/${f.ids[host]}/${kind}${id ? `/${id}` : ''}`;

test('unconfigured server fails closed; no mock login/provider call can be enabled', async () => {
  const app = createApp();
  for (const [method, path] of [['GET', '/api/session'], ['POST', '/api/auth/login'], ['POST', '/api/auth/register'],
    ['GET', '/api/auth/callback'], ['POST', '/api/auth/logout'], ['POST', '/api/onboarding'],
    ['GET', `/api/hosts/${randomUUID()}/reservations`]]) {
    const res = await app({ method, path, headers: { origin: LOCAL_ORIGIN, 'content-type': 'application/json' } });
    assert.equal(res.status, 501); assert.equal(res.body.code, 'NOT_CONFIGURED');
    assert.equal(res.headers['cache-control'], 'no-store'); assert.equal(res.headers['set-cookie'], undefined);
  }
  assert.throws(() => createApp({ mode: 'production' }), /OFFLINE_ONLY/);
  assert.throws(() => createApp({ auth: {} }), /OFFLINE_ONLY/);
  assert.throws(() => createApp({ mode: 'test' }), /OFFLINE_ONLY/);
  assert.throws(() => createApp({ origin: 'https://public.example' }), /OFFLINE_ONLY/);
});
test('anonymous and forged localStorage/header/body identities are rejected', async () => {
  const f = fixtures();
  for (const headers of [{}, { cookie: 'sb_session={"userId":"A","plan":"pro"}' },
    { authorization: 'Bearer forged', 'x-user-id': f.ids.a }, { cookie: `${COOKIE}=${'0'.repeat(64)}` },
    { cookie: `${COOKIE}=${f.tokens.a}; ${COOKIE}=${f.tokens.a}` }]) {
    const res = await f.request(null, 'GET', pathFor(f), { user_id: f.ids.a }, headers);
    assert.equal(res.status, 401);
  }
});
test('A/B tenant separation applies to lists, IDs, mutations and foreign keys', async () => {
  const f = fixtures();
  const made = await f.request('a', 'POST', pathFor(f), f.reservation);
  assert.equal(made.status, 201);
  assert.equal((await f.request('b', 'GET', pathFor(f, 'hb'))).body.length, 0);
  for (const method of ['GET', 'PATCH', 'DELETE']) {
    const res = await f.request('b', method, pathFor(f, 'hb', 'reservations', made.body.id), method === 'DELETE' ? {} : { guest_name: 'Intruder' }, { 'if-match': '"1"' });
    assert.equal(res.status, 404);
  }
  assert.equal((await f.request('a', 'GET', pathFor(f, 'hb'))).status, 404);
  for (const changed of [{ room_id: f.ids.rb }, { property_id: f.ids.pb }]) {
    assert.equal((await f.request('a', 'POST', pathFor(f), { ...f.reservation, ...changed })).status, 404);
  }
  assert.equal((await f.request('a', 'GET', pathFor(f))).body[0].guest_name, 'Synthetic guest');
});
test('viewer cannot mutate and role revocation/suspension takes effect on next request', async () => {
  const f = fixtures();
  assert.equal((await f.request('viewer', 'GET', pathFor(f))).status, 200);
  assert.equal((await f.request('viewer', 'POST', pathFor(f), f.reservation)).status, 403);
  f.memberships.set(`${f.ids.a}:${f.ids.ha}`, 'viewer');
  assert.equal((await f.request('a', 'POST', pathFor(f), f.reservation)).status, 403);
  f.memberships.delete(`${f.ids.viewer}:${f.ids.ha}`);
  assert.equal((await f.request('viewer', 'GET', pathFor(f))).status, 404);
  f.organizations.get(f.ids.ha).active = false;
  assert.equal((await f.request('a', 'GET', pathFor(f))).status, 404);
});
test('stable UUID room identity survives duplicate display names and rename', async () => {
  const f = fixtures();
  const made = await f.request('a', 'POST', pathFor(f), f.reservation);
  const renamed = await f.request('a', 'PATCH', pathFor(f, 'ha', 'rooms', f.ids.ra), { name: 'Renamed' }, { 'if-match': '"1"' });
  assert.equal(renamed.status, 200); assert.equal(renamed.body.id, f.ids.ra);
  const read = await f.request('a', 'GET', pathFor(f, 'ha', 'reservations', made.body.id));
  assert.equal(read.body.room_id, f.ids.ra); assert.notEqual(f.ids.ra, f.ids.rb);
});
test('mutation validation rejects mass assignment, invalid dates, amounts and identifiers', async () => {
  const f = fixtures();
  for (const patch of [{ host_id: f.ids.hb }, { id: randomUUID() }, { created_by: f.ids.b },
    { role: 'owner' }, { version: 100 }, { archived: true }, { check_in: '2026-02-30' },
    { check_out: '2026-10-19' }, { room_id: 'room-name' }, { amount_krw: -1 },
    { amount_krw: '100' }, { status: 'paid' }, { guest_name: ' ' }]) {
    assert.equal((await f.request('a', 'POST', pathFor(f), { ...f.reservation, ...patch })).status, 400);
  }
  assert.equal(f.tables.reservations.size, 0);
});
test('CSRF, origin, content-type, host and method guards run before writes', async () => {
  const f = fixtures();
  for (const [headers, status] of [[{ origin: 'https://evil.example' }, 403], [{ origin: '' }, 403],
    [{ 'x-csrf-token': 'forged' }, 403], [{ 'x-csrf-token': '' }, 403], [{ 'content-type': 'text/plain' }, 415],
    [{ host: 'evil.example' }, 403], [{ 'sec-fetch-site': 'cross-site' }, 403], [{ 'x-http-method-override': 'DELETE' }, 400]]) {
    assert.equal((await f.request('a', 'POST', pathFor(f), f.reservation, headers)).status, status);
  }
  const res = await f.request('a', 'PUT', pathFor(f), f.reservation);
  assert.equal(res.status, 405); assert.equal(res.headers.allow, 'GET, POST');
  assert.equal((await f.request('a', 'GET', '/api/auth/logout')).status, 405);
  assert.equal(f.tables.reservations.size, 0);
});
test('optimistic version protects update and soft deletion from stale writes', async () => {
  const f = fixtures();
  const made = await f.request('a', 'POST', pathFor(f), f.reservation);
  const path = pathFor(f, 'ha', 'reservations', made.body.id);
  assert.equal((await f.request('a', 'PATCH', path, { amount_krw: 20000 })).status, 428);
  const replies = await Promise.all([10001, 10002].map(amount_krw => f.request('a', 'PATCH', path, { amount_krw }, { 'if-match': '"1"' })));
  assert.deepEqual(replies.map(r => r.status).sort(), [200, 409]);
  assert.equal((await f.request('a', 'DELETE', path, {}, { 'if-match': '"1"' })).status, 409);
  assert.equal((await f.request('a', 'PATCH', path, { check_out: '2026-10-19' }, { 'if-match': '"2"' })).status, 400);
  assert.equal((await f.request('a', 'DELETE', path, {}, { 'if-match': '"2"' })).status, 200);
  assert.equal(f.tables.reservations.size, 1); assert.equal(f.tables.reservations.get(made.body.id).archived, true);
  assert.equal((await f.request('a', 'GET', pathFor(f))).body.length, 0);
});
test('verified onboarding produces empty tenant; same key retries do not duplicate', async () => {
  const f = fixtures(), key = randomUUID();
  const body = { host_name: 'Synthetic new host', property_name: 'Synthetic property', room_name: 'Synthetic room' };
  const created = await f.request('newUser', 'POST', '/api/onboarding', body, { 'idempotency-key': key });
  assert.equal(created.status, 201);
  const retried = await f.request('newUser', 'POST', '/api/onboarding', body, { 'idempotency-key': key });
  assert.deepEqual(retried.body, created.body);
  assert.equal((await f.request('newUser', 'POST', '/api/onboarding', { ...body, host_name: 'Different' }, { 'idempotency-key': key })).status, 409);
  assert.deepEqual((await f.request('newUser', 'GET', `/api/hosts/${created.body.host_id}/reservations`)).body, []);
  assert.equal((await f.request('a', 'GET', `/api/hosts/${created.body.host_id}/rooms`)).status, 404);
});
test('unverified, expired and revoked sessions fail; logout invalidates session', async () => {
  for (const change of [{ emailVerified: false }, { expiresAt: 0 }, { revoked: true }]) {
    const f = fixtures(); Object.assign(f.sessions.get(f.tokens.a), change);
    assert.equal((await f.request('a', 'GET', '/api/session')).status, change.emailVerified === false ? 403 : 401);
  }
  const f = fixtures();
  const session = await f.request('a', 'GET', '/api/session');
  assert.equal(session.body.mode, 'test'); assert.equal(JSON.stringify(session).includes(f.tokens.a), false);
  assert.equal((await f.request('a', 'POST', '/api/auth/logout', {})).status, 200);
  assert.equal((await f.request('a', 'GET', '/api/session')).status, 401);
  assert.equal((await f.request('b', 'GET', '/api/session')).status, 200);
});
test('property/room CRUD preserves parent IDs and archived room cannot receive new reservation', async () => {
  const f = fixtures();
  const p = await f.request('a', 'POST', pathFor(f, 'ha', 'properties'), { name: 'Synthetic second' });
  const r = await f.request('a', 'POST', pathFor(f, 'ha', 'rooms'), { property_id: p.body.id, name: 'New room' });
  assert.equal(r.status, 201);
  assert.equal((await f.request('a', 'PATCH', pathFor(f, 'ha', 'rooms', r.body.id), { property_id: f.ids.pa }, { 'if-match': '"1"' })).status, 400);
  assert.equal((await f.request('a', 'POST', pathFor(f), { ...f.reservation, room_id: r.body.id })).status, 404);
  assert.equal((await f.request('a', 'DELETE', pathFor(f, 'ha', 'rooms', f.ids.ra), {}, { 'if-match': '"1"' })).status, 200);
  assert.equal((await f.request('a', 'POST', pathFor(f), f.reservation)).status, 404);
});
test('future invitations, iCal, migration and role-changing routes stay unavailable', async () => {
  const f = fixtures();
  for (const route of ['ical-feeds', 'invitations', 'migration', 'memberships']) {
    assert.equal((await f.request('a', 'POST', `/api/hosts/${f.ids.ha}/${route}`, {})).status, 404);
  }
});
