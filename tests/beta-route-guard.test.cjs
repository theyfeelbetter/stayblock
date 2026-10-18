'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
for(const file of ['api/hosts/[hostId]/reservations.mjs','api/hosts/[hostId]/reservations/[reservationId].mjs']){
 test(file+' is disabled unless owner enables beta',()=>{
   const text=fs.readFileSync(path.join(__dirname,'..',file),'utf8');
   assert.match(text,/STAYBLOCK_BETA_API_ENABLED/);
   assert.match(text,/BETA_API_DISABLED/);
   assert.match(text,/assertDbTarget\(process\.env\)/);
   assert.match(text,/BETA_NOT_CONFIGURED/);
   assert.ok(text.indexOf("STAYBLOCK_BETA_API_ENABLED",text.indexOf('export default async function handler'))<text.indexOf("db=guardedPool()"),'deny before runtime DB connection');
 });
}
