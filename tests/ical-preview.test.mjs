import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {parseIcs,compareIcs} from '../ui/ical-preview.mjs';
test('OTA synthetic calendar parses two blocks',()=>{
 const text=fs.readFileSync(new URL('./fixtures/ota-sample.ics',import.meta.url),'utf8');
 const {events,skipped}=parseIcs(text);assert.equal(events.length,2);assert.equal(skipped,0);
 assert.deepEqual([events[0].start,events[0].end],['2026-11-20','2026-11-23']);
});
test('checkout is exclusive and true overlaps are detected',()=>{
 const text=fs.readFileSync(new URL('./fixtures/ota-sample.ics',import.meta.url),'utf8');
 const events=parseIcs(text).events;
 const room='roomA';
 const results=compareIcs(events,[{room_id:room,status:'confirmed',check_in:'2026-11-23',check_out:'2026-11-27'}],room);
 assert.equal(results[0].conflict,false);assert.equal(results[1].conflict,false);
 const hit=compareIcs(events,[{room_id:room,status:'confirmed',check_in:'2026-11-21',check_out:'2026-11-22'}],room);
 assert.equal(hit[0].conflict,true);assert.equal(hit[1].conflict,false);
});
