import test from 'node:test';
import assert from 'node:assert/strict';
import {diffOtaEvents} from '../bff/ota-diff.mjs';
test('identical feeds are idempotent',()=>{
 const e=[{uid:'A',start:'2026-11-01',end:'2026-11-04'}];
 assert.deepEqual(diffOtaEvents(e,e),{added:[],changed:[],missing:[],unchangedCount:1});
});
test('new, changed, missing events are distinct',()=>{
 const p=[{uid:'A',start:'2026-11-01',end:'2026-11-04'},{uid:'B',start:'2026-11-08',end:'2026-11-09'}];
 const c=[{uid:'A',start:'2026-11-02',end:'2026-11-05'},{uid:'C',start:'2026-11-10',end:'2026-11-12'}];
 const x=diffOtaEvents(p,c);
 assert.equal(x.changed.length,1);assert.equal(x.added.length,1);assert.equal(x.missing.length,1);assert.equal(x.unchangedCount,0);
});
test('duplicate UIDs rejected rather than silently overwriting',()=>{
 assert.throws(()=>diffOtaEvents([],[{uid:'X'},{uid:'X'}]),/DUPLICATE/);
});
