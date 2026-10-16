const test = require('node:test');const assert = require('node:assert/strict');
const {readNeonConfig}=require('../bff/neon-config.cjs');
const valid='postgresql://app:secret@ep-sample.aws.neon.tech/stayblock?sslmode=require';
test('accepts Neon TLS URL without exposing credentials',()=>{const c=readNeonConfig({DATABASE_URL:valid});assert.equal(c.database,'stayblock');assert.equal(c.hostname,'ep-sample.aws.neon.tech');assert.ok(!JSON.stringify(c).includes('secret'));assert.ok(!Object.hasOwn(c,'password'));});
test('rejects missing or non-Neon hosts',()=>{assert.throws(()=>readNeonConfig({}),/DATABASE_URL_MISSING/);assert.throws(()=>readNeonConfig({DATABASE_URL:'postgresql://app:secret@localhost/db?sslmode=require'}),/NEON_HOST_REQUIRED/);});
test('requires database name and TLS',()=>{assert.throws(()=>readNeonConfig({DATABASE_URL:'postgresql://app:secret@ep-sample.aws.neon.tech/db'}),/NEON_SSL_REQUIRED/);assert.throws(()=>readNeonConfig({DATABASE_URL:'postgresql://app:secret@ep-sample.aws.neon.tech/?sslmode=require'}),/DATABASE_URL_INVALID/);});
test('disallows non-PostgreSQL URL',()=>assert.throws(()=>readNeonConfig({DATABASE_URL:'https://example.com/db?sslmode=require'}),/DATABASE_URL_INVALID/));
