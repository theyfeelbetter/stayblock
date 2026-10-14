'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { readFileSync } = require('node:fs');
const task = 'stayblock_task003b_000000000000';
test('local DB runner refuses remote, default DB, malformed name and confirmation mismatch before connecting', () => {
  for (const [host, port, db, confirm] of [
    ['db.example.com','5432',task,task], ['127.0.0.1','5433',task,task],
    ['127.0.0.1','5432','postgres','postgres'], ['127.0.0.1','5432','stayblock_task003b_bad','stayblock_task003b_bad'],
    ['127.0.0.1','5432',task,'wrong'], ['127.0.0.1','5432',"x';DROP DATABASE postgres;--",task],
  ]) {
    const result = spawnSync('python3', ['db/local/run.py','test','--host',host,'--port',port,'--db',db,'--confirm',confirm], { encoding:'utf8' });
    assert.equal(result.status,1); assert.match(result.stderr, /Only explicit|Exact task DB/);
    assert.doesNotMatch(result.stdout, /PostgreSQL|PASS/);
  }
});
test('local DB runner refuses missing creation receipt without connecting', () => {
  const result = spawnSync('python3', ['db/local/run.py','teardown','--host','127.0.0.1','--port','5432','--db',task,'--confirm',task], { encoding:'utf8' });
  assert.equal(result.status,1); assert.match(result.stderr,/Missing matching local creation receipt/);
});
test('production drafts retain unconditional execution guards', () => {
  for (const path of ['db/drafts/0001_schema.sql','db/drafts/0002_rls.sql']) {
    assert.match(readFileSync(path,'utf8'), /raise exception 'DRAFT_ONLY_NOT_APPROVED_FOR_EXECUTION'/);
  }
});
test('psql refusal uses ON_ERROR_STOP rather than unsupported quit exit-code arguments', () => {
  for (const path of ['db/local/run.py','db/local/sql/identity.sql','db/local/sql/teardown_roles.sql']) {
    const source = readFileSync(path,'utf8');
    assert.doesNotMatch(source, /\\quit 3/);
    assert.match(source, /SELECT 1 \/ 0/);
  }
});
