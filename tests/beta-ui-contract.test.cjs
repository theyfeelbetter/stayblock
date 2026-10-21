'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const page=fs.readFileSync(path.join(__dirname,'..','beta.html'),'utf8');
test('beta UI uses server session and no localStorage guest persistence',()=>{
 assert.match(page,/\/api\/auth\/get-session/);
 assert.match(page,/\/api\/auth\/sign-in\/email/);
 assert.match(page,/\/api\/me/);
 assert.match(page,/\/api\/hosts\//);
 assert.doesNotMatch(page,/localStorage|sessionStorage/);
});
test('beta UI does not interpolate server input into HTML',()=>{
 assert.doesNotMatch(page,/\.innerHTML\s*=/);
 assert.match(page,/td\.textContent=value/);
});
test('host context derives allowed hosts server-side',()=>{
 const code=fs.readFileSync(path.join(__dirname,'..','bff/host-context.cjs'),'utf8');
 assert.match(code,/withVerifiedDbSession/);
 assert.match(code,/stayblock\.memberships/);
 assert.match(code,/m\.active=true/);
});
test('host endpoint defaults disabled until gate',()=>{
 const code=fs.readFileSync(path.join(__dirname,'..','api/me.mjs'),'utf8');
 assert.match(code,/STAYBLOCK_BETA_API_ENABLED/);
 assert.match(code,/assertDbTarget/);
});
