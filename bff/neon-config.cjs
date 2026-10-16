'use strict';
// Neon/PostgreSQL server runtime configuration gate. No connections or side effects.
function readNeonConfig(env = process.env) {
  const url = env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL_MISSING');
  let parsed;
  try { parsed = new URL(url); } catch { throw new Error('DATABASE_URL_INVALID'); }
  if (!['postgresql:', 'postgres:'].includes(parsed.protocol) || !parsed.hostname ||
      !parsed.username || !parsed.pathname || parsed.pathname === '/') {
    throw new Error('DATABASE_URL_INVALID');
  }
  if (parsed.searchParams.get('sslmode') !== 'require' &&
      parsed.searchParams.get('sslmode') !== 'verify-full') {
    throw new Error('NEON_SSL_REQUIRED');
  }
  if (!parsed.hostname.endsWith('.neon.tech')) throw new Error('NEON_HOST_REQUIRED');
  return Object.freeze({
    protocol: parsed.protocol,
    hostname: parsed.hostname,
    database: decodeURIComponent(parsed.pathname.slice(1)),
    sslmode: parsed.searchParams.get('sslmode'),
    // Intentionally NEVER return username/password, URI, tokens or cookies.
  });
}
module.exports = { readNeonConfig };
