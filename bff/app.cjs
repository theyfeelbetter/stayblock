'use strict';

const { randomUUID, timingSafeEqual } = require('node:crypto');
const { ApiError, fail, uuid, object, text, validate, expectedVersion } = require('./validation.cjs');
const LOCAL_ORIGIN = 'http://127.0.0.1:8787';
// Local HTTP only. Future HTTPS production must use __Host- prefix + Secure.
const COOKIE = 'sb_offline_session';
const routes = [
  [/^\/api\/auth\/(register|login|password-reset|reset-complete)$/, ['POST'], 'auth'],
  [/^\/api\/auth\/callback$/, ['GET'], 'auth'],
  [/^\/api\/auth\/logout$/, ['POST'], 'logout'],
  [/^\/api\/session$/, ['GET'], 'session'],
  [/^\/api\/onboarding$/, ['POST'], 'onboarding'],
  [/^\/api\/hosts\/([^/]+)\/(properties|rooms|reservations)(?:\/([^/]+))?$/, null, 'resource'],
];
function equal(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const left = Buffer.from(a), right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}
function cookieToken(header = '') {
  const values = header.split(';').map(x => x.trim()).filter(x => x.startsWith(`${COOKIE}=`));
  if (values.length !== 1) return null;
  const token = values[0].slice(COOKIE.length + 1);
  return /^[a-f0-9]{64}$/.test(token) ? token : null;
}
function createApp({ mode = 'not_configured', auth, repository, origin = LOCAL_ORIGIN } = {}) {
  // This is an injectable offline contract harness, NOT a production auth implementation.
  if (!['not_configured', 'test'].includes(mode) || origin !== LOCAL_ORIGIN ||
      (mode === 'test' && (!auth || !repository)) ||
      (mode !== 'test' && (auth || repository)) || process.env.NODE_ENV === 'production') {
    throw new Error('OFFLINE_ONLY');
  }
  return async function dispatch(request) {
    const requestId = randomUUID();
    const headers = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store',
      'x-content-type-options': 'nosniff', 'x-stayblock-mode': mode };
    const respond = (status, data) => ({ status, headers, body: data });
    try {
      const h = Object.fromEntries(Object.entries(request.headers || {}).map(([k, v]) => [k.toLowerCase(), v]));
      if (h.host && h.host !== new URL(origin).host) fail(403, 'HOST_FORBIDDEN');
      if (typeof request.path !== 'string' || !request.path.startsWith('/api/') || request.path.startsWith('//')) fail(404, 'NOT_FOUND');
      const url = new URL(request.path, origin);
      if (url.origin !== origin) fail(400, 'INVALID_PATH');
      const method = request.method || 'GET';
      const route = routes.find(([pattern]) => pattern.test(url.pathname));
      if (!route) fail(404, 'NOT_FOUND');
      const match = url.pathname.match(route[0]);
      const [, methods, type] = route;
      const allowed = methods || (match[3] ? ['GET', 'PATCH', 'DELETE'] : ['GET', 'POST']);
      if (!allowed.includes(method)) { headers.allow = allowed.join(', '); fail(405, 'METHOD_NOT_ALLOWED'); }
      const mutation = method !== 'GET';
      if (h['x-http-method-override']) fail(400, 'METHOD_OVERRIDE_FORBIDDEN');
      if (h.origin && h.origin !== origin) fail(403, 'ORIGIN_FORBIDDEN');
      if (h['sec-fetch-site'] && !['same-origin', 'none'].includes(h['sec-fetch-site'])) fail(403, 'ORIGIN_FORBIDDEN');
      if (mutation && h.origin !== origin) fail(403, 'ORIGIN_REQUIRED');
      if (mutation && h['content-type']?.split(';')[0].trim().toLowerCase() !== 'application/json') fail(415, 'JSON_REQUIRED');
      if (type === 'auth') fail(501, 'NOT_CONFIGURED'); // Never consumes credentials or creates mock login.
      if (mode !== 'test') fail(501, 'NOT_CONFIGURED');
      const token = cookieToken(h.cookie);
      const session = token && await auth.resolve(token);
      if (!session || !uuid(session.userId) || !Number.isFinite(session.expiresAt) ||
          session.expiresAt <= Date.now() || session.revoked) fail(401, 'UNAUTHENTICATED');
      if (!session.emailVerified) fail(403, 'EMAIL_UNVERIFIED');
      if (mutation && !equal(h['x-csrf-token'], session.csrf)) fail(403, 'CSRF_INVALID');
      if (type === 'logout') {
        await auth.revoke(token);
        headers['set-cookie'] = `${COOKIE}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0`;
        return respond(200, { logged_out: true, mode: 'test' });
      }
      if (type === 'session') return respond(200, { user_id: session.userId, csrf_token: session.csrf,
        hosts: await repository.hosts(session.userId), mode: 'test' });
      if (type === 'onboarding') {
        object(request.body, ['host_name', 'property_name', 'room_name']);
        if (!['host_name', 'property_name', 'room_name'].every(k => text(request.body[k], 120))) fail(400, 'INVALID_BODY');
        if (!uuid(h['idempotency-key'])) fail(400, 'IDEMPOTENCY_KEY_REQUIRED');
        return respond(201, await repository.onboard(session.userId, request.body, h['idempotency-key']));
      }
      const [, hostId, kind, id] = match;
      if (!uuid(hostId) || (id && !uuid(id))) fail(400, 'INVALID_ID');
      const role = await repository.role(session.userId, hostId);
      if (!['owner', 'manager', 'viewer'].includes(role)) fail(404, 'NOT_FOUND');
      if (mutation && role === 'viewer') fail(403, 'FORBIDDEN');
      // Scope is supplied by verified session + server role lookup, never by body/localStorage.
      const scope = { hostId, userId: session.userId };
      if (method === 'GET') {
        if (url.search) fail(400, 'FILTERS_NOT_IMPLEMENTED'); // No unbounded pseudo-pagination.
        const data = await repository.read(scope, kind, id);
        if (id && !data) fail(404, 'NOT_FOUND');
        return respond(200, data);
      }
      if (method === 'POST') return respond(201, await repository.create(scope, kind, validate(kind, request.body)));
      const version = expectedVersion(h['if-match']);
      if (method === 'DELETE') object(request.body, []);
      const data = await repository.update(scope, kind, id, version,
        method === 'DELETE' ? { archived: true } : validate(kind, request.body, true));
      return respond(200, data);
    } catch (error) {
      // Never echo request body, credentials, provider errors or stack into a response/log.
      return respond(error instanceof ApiError ? error.status : 500,
        { code: error instanceof ApiError ? error.code : 'INTERNAL_ERROR', request_id: requestId });
    }
  };
}
module.exports = { createApp, COOKIE, LOCAL_ORIGIN };
