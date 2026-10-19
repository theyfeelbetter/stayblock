import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const html=fs.readFileSync(new URL('../beta.html',import.meta.url),'utf8');
test('Hybrid mobile viewport respects notches and safe areas',()=>{
 assert.match(html,/viewport-fit=cover/);
 assert.match(html,/env\(safe-area-inset-bottom/);
 assert.match(html,/100dvh/);
});
test('Mobile tools remain booking, properties, OTA only',()=>{
 const dock=html.match(/<nav class="mobile-dock"[\s\S]*?<\/nav>/)?.[0];
 assert.ok(dock,'mobile action dock exists');
 for(const id of ['foldProperty','foldBooking','foldOta'])assert.ok(dock.includes('data-quick="'+id+'"'));
 assert.equal((dock.match(/data-quick=/g)||[]).length,3);
});
test('Mobile calendar and reservations precede management sidebar',()=>{
 const calendar=html.indexOf('id="calendarGrid"');
 const reservations=html.indexOf('id="bookings"');
 const sidebar=html.indexOf('class="workspace-sidebar"');
 assert.ok(calendar>0&&reservations>calendar&&sidebar>reservations);
});
test('Drill-down edits use the same desktop form, no second reservation form',()=>{
 assert.equal((html.match(/id="bookingForm"/g)||[]).length,1);
 assert.equal((html.match(/id="icsSave"/g)||[]).length,1);
 assert.match(html,/function openMobileEditor/);
 assert.match(html,/openMobileEditor\('foldBooking'\)/);
});
test('The embedded module script parses as JavaScript',async()=>{
 const js=html.match(/<script type="module">([\s\S]*?)<\/script>/)?.[1];
 assert.ok(js);
 const {spawnSync}=await import('node:child_process');
 const proc=spawnSync(process.execPath,['--input-type=module','--check'],{input:js,encoding:'utf8'});
 assert.equal(proc.status,0,proc.stderr);
});
