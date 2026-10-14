'use strict';

// Synthetic, volatile TEST DOUBLE. No network, filesystem, browser or provider access.
const { randomUUID, randomBytes } = require('node:crypto');
const { fail, validate } = require('../../bff/validation.cjs');
const { createApp, COOKIE, LOCAL_ORIGIN } = require('../../bff/app.cjs');
function fixtures() {
  const ids = Object.fromEntries(['a', 'b', 'viewer', 'newUser', 'ha', 'hb', 'pa', 'pb', 'ra', 'rb'].map(k => [k, randomUUID()]));
  const tables = { properties: new Map(), rooms: new Map(), reservations: new Map() };
  const organizations = new Map([[ids.ha, { id: ids.ha, name: 'Synthetic A', active: true }], [ids.hb, { id: ids.hb, name: 'Synthetic B', active: true }]]);
  const memberships = new Map([[`${ids.a}:${ids.ha}`, 'owner'], [`${ids.b}:${ids.hb}`, 'owner'], [`${ids.viewer}:${ids.ha}`, 'viewer']]);
  const sessions = new Map(), tokens = {}, csrf = {};
  for (const user of ['a', 'b', 'viewer', 'newUser']) {
    tokens[user] = randomBytes(32).toString('hex'); csrf[user] = randomBytes(32).toString('hex');
    sessions.set(tokens[user], { userId: ids[user], csrf: csrf[user], emailVerified: true, expiresAt: Date.now() + 60_000 });
  }
  for (const suffix of ['a', 'b']) {
    tables.properties.set(ids[`p${suffix}`], { id: ids[`p${suffix}`], host_id: ids[`h${suffix}`], name: `Synthetic property ${suffix}`, version: 1, archived: false });
    tables.rooms.set(ids[`r${suffix}`], { id: ids[`r${suffix}`], host_id: ids[`h${suffix}`], property_id: ids[`p${suffix}`], name: 'Same display name', version: 1, archived: false });
  }
  const copy = value => structuredClone(value);
  const own = (table, host, id) => {
    const row = tables[table].get(id);
    return row?.host_id === host ? row : undefined;
  };
  function relations(scope, kind, body) {
    if (kind !== 'properties') {
      const property = own('properties', scope.hostId, body.property_id);
      if (!property || property.archived) fail(404, 'NOT_FOUND');
    }
    if (kind === 'reservations') {
      const room = own('rooms', scope.hostId, body.room_id);
      if (!room || room.archived || room.property_id !== body.property_id) fail(404, 'NOT_FOUND');
    }
  }
  const batches = new Map();
  const repository = {
    async role(user, host) { return organizations.get(host)?.active ? memberships.get(`${user}:${host}`) : undefined; },
    async hosts(user) {
      const result = [];
      for (const org of organizations.values()) {
        const role = await this.role(user, org.id);
        if (role) result.push({ id: org.id, name: org.name, role });
      }
      return result;
    },
    async read(scope, kind, id) {
      if (id) return copy(own(kind, scope.hostId, id));
      const rows = [...tables[kind].values()].filter(r => r.host_id === scope.hostId && !r.archived);
      if (rows.length > 200) fail(501, 'PAGINATION_NOT_IMPLEMENTED');
      return copy(rows);
    },
    async create(scope, kind, body) {
      relations(scope, kind, body);
      const row = { ...copy(body), id: randomUUID(), host_id: scope.hostId, created_by: scope.userId,
        updated_by: scope.userId, version: 1, archived: false, ...(kind === 'reservations' ? { status: body.status || 'confirmed' } : {}) };
      tables[kind].set(row.id, row);
      return copy(row);
    },
    async update(scope, kind, id, version, body) {
      const old = own(kind, scope.hostId, id);
      if (!old) fail(404, 'NOT_FOUND');
      if (old.version !== version) fail(409, 'VERSION_CONFLICT');
      if (old.archived) fail(409, 'ARCHIVED');
      if (kind === 'rooms' && body.property_id && body.property_id !== old.property_id) fail(400, 'IMMUTABLE_PARENT');
      const next = { ...old, ...copy(body), version: version + 1, updated_by: scope.userId };
      if (!body.archived) {
        const { host_id, id: rowId, created_by, updated_by, version: newVersion, archived, ...fields } = next;
        validate(kind, fields); relations(scope, kind, next);
      }
      // Synchronous compare/write models optimistic concurrency, not Postgres transaction behavior.
      tables[kind].set(id, next);
      return copy(next);
    },
    async onboard(user, body, key) {
      const batchKey = `${user}:${key}`, previous = batches.get(batchKey), payload = JSON.stringify(body);
      if (previous) { if (previous.payload !== payload) fail(409, 'IDEMPOTENCY_CONFLICT'); return copy(previous.result); }
      const host = randomUUID(), property = randomUUID(), room = randomUUID();
      organizations.set(host, { id: host, name: body.host_name, active: true });
      memberships.set(`${user}:${host}`, 'owner');
      tables.properties.set(property, { id: property, host_id: host, name: body.property_name, version: 1, archived: false });
      tables.rooms.set(room, { id: room, host_id: host, property_id: property, name: body.room_name, version: 1, archived: false });
      const result = { host_id: host, property_id: property, room_id: room, mode: 'test' };
      batches.set(batchKey, { payload, result }); return copy(result);
    },
  };
  const auth = { resolve: async token => copy(sessions.get(token)), revoke: async token => { sessions.delete(token); } };
  const app = createApp({ mode: 'test', auth, repository });
  const request = (user, method, path, body, headers = {}) => app({ method, path, body, headers: {
    host: '127.0.0.1:8787', origin: LOCAL_ORIGIN, 'content-type': 'application/json',
    ...(user ? { cookie: `${COOKIE}=${tokens[user]}`, 'x-csrf-token': csrf[user] } : {}), ...headers,
  } });
  const reservation = { property_id: ids.pa, room_id: ids.ra, guest_name: 'Synthetic guest', check_in: '2026-10-20', check_out: '2026-10-22', amount_krw: 10000 };
  return { ids, tables, organizations, memberships, sessions, tokens, csrf, app, request, reservation };
}
module.exports = { fixtures };
