'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { once } = require('node:events');
const { createLocalServer } = require('../bff/dev.cjs');

test('real loopback HTTP transport: 501, host guard, malformed JSON and body limit', async t => {
  const server = createLocalServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise(resolve => server.close(resolve)));
  const send = (path, method = 'GET', raw = '', extra = {}) => new Promise((resolve, reject) => {
    const request = http.request({ hostname: '127.0.0.1', port: server.address().port, path, method,
      headers: { host: '127.0.0.1:8787', origin: 'http://127.0.0.1:8787', 'content-type': 'application/json', ...extra } }, response => {
      let body = ''; response.on('data', chunk => { body += chunk; });
      response.on('end', () => resolve({ status: response.statusCode, body: JSON.parse(body), headers: response.headers }));
    });
    request.on('error', reject); request.end(raw);
  });
  const session = await send('/api/session');
  assert.equal(session.status, 501); assert.equal(session.body.code, 'NOT_CONFIGURED');
  assert.equal(session.headers['cache-control'], 'no-store');
  assert.equal((await send('/api/auth/login', 'POST', '{}')).status, 501);
  assert.equal((await send('/api/auth/login', 'POST', '{broken')).status, 400);
  assert.equal((await send('/api/auth/login', 'POST', ' '.repeat(16_385))).status, 413);
  assert.equal((await send('/api/session', 'GET', '', { host: 'attacker.example' })).status, 403);
  assert.equal((await send('/app.html')).status, 404); // Not an accidental legacy-app host.
});
