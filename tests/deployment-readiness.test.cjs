'use strict';const test=require('node:test'),assert=require('node:assert/strict');
const {assertDbTarget}=require('../bff/deployment-readiness.cjs');
const fixture={DATABASE_URL:'postgresql://stayblock_http:fake@ep-dev.aws.neon.tech/neondb?sslmode=require',AUTH_DATABASE_URL:'postgresql://stayblock_auth_login:fake@ep-dev.aws.neon.tech/neondb?sslmode=require',BETTER_AUTH_URL:'https://stayblock.example',BETTER_AUTH_SECRET:'this-is-only-a-placeholder-fixture-secret'};
test('two separate least-privileged roles on same Neon branch',()=>{const r=assertDbTarget(fixture);assert.equal(r.ready,true);assert.ok(!JSON.stringify(r).includes('fake'))});
test('rejects privileged booking role',()=>assert.throws(()=>assertDbTarget({...fixture,DATABASE_URL:fixture.DATABASE_URL.replace('stayblock_http','neondb_owner')}),/ROLE_OR_TLS_UNSAFE/));
test('rejects production/development database mismatch',()=>assert.throws(()=>assertDbTarget({...fixture,AUTH_DATABASE_URL:fixture.AUTH_DATABASE_URL.replace('ep-dev','ep-prod')}),/DATABASE_BRANCH_MISMATCH/));
test('rejects insecure auth URL',()=>assert.throws(()=>assertDbTarget({...fixture,BETTER_AUTH_URL:'http://localhost:3000'}),/HTTPS_REQUIRED/));
test('rejects missing database credentials',()=>assert.throws(()=>assertDbTarget({...fixture,DATABASE_URL:''}),/MISSING/));
