#!/usr/bin/env node
// Local-only booking HTTP smoke test with real Better Auth cookies and RLS.
import fs from 'node:fs';
import crypto from 'node:crypto';
import http from 'node:http';
import pg from 'pg';
import {betterAuth} from 'better-auth';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {handleReservationApi}=require('../bff/beta-reservations.cjs');
const dir=process.env.HOME+'/stayblock-private/';
if(process.env.CI||process.env.VERCEL)throw Error('LOCAL_ONLY');
const admin=fs.readFileSync(dir+'neon-dev-uri','utf8').trim();
const runtime=fs.readFileSync(dir+'neon-http-uri','utf8').trim();
const a=new URL(admin),r=new URL(runtime);
if(a.hostname!==r.hostname||a.pathname!==r.pathname||a.username!=='neondb_owner'||r.username!=='stayblock_http'||process.env.EXPECTED_DEV_DATABASE_HOST!==r.hostname)throw Error('DEVELOPMENT_ROLE_HOST_MISMATCH');
const people=JSON.parse(fs.readFileSync(dir+'host-passwords.json','utf8'));
if(people.length!==3)throw Error('THREE_TEST_USERS_REQUIRED');
const lookup=new pg.Pool({connectionString:admin,ssl:{rejectUnauthorized:true},options:'-c search_path=stayblock_auth',max:2});
const booking=new pg.Pool({connectionString:runtime,ssl:{rejectUnauthorized:true},max:2});
const auth=betterAuth({baseURL:'http://127.0.0.1:47835',secret:crypto.randomBytes(48).toString('base64url'),database:lookup,emailAndPassword:{enabled:true,disableSignUp:true},trustedOrigins:['http://127.0.0.1:47835']});
const contexts=(await lookup.query('SELECT u.email,m.host_id,r.id AS room_id FROM stayblock_auth."user" u JOIN stayblock.memberships m ON m.user_id=u.id JOIN stayblock.rooms r ON r.host_id=m.host_id')).rows;
const testUsers=people.map(p=>({...p,...contexts.find(c=>c.email===p.email)}));
if(testUsers.some(p=>!p.host_id||!p.room_id))throw Error('MISSING_TEST_TENANTS');
const base='http://127.0.0.1:47835';
const server=http.createServer(async(req,res)=>{
 try{
  const u=new URL(req.url,base);
  let content='';for await(const chunk of req){content+=chunk;if(content.length>20000){res.writeHead(413).end();return}}
  let response;
  if(u.pathname.startsWith('/api/auth/')){
   const request=new Request(u,{method:req.method,headers:new Headers(req.headers),body:['GET','HEAD'].includes(req.method)?undefined:content});
   response=await auth.handler(request);
   res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));return;
  }
  const parts=u.pathname.split('/');
  if(parts.length>=5&&parts[1]==='api'&&parts[2]==='hosts'&&parts[4]==='reservations'){
   const outcome=await handleReservationApi({auth,pool:booking,headers:new Headers(req.headers),method:req.method,hostId:parts[3],reservationId:parts[5],body:content?JSON.parse(content):undefined});
   res.writeHead(outcome.status,{'content-type':'application/json'});res.end(JSON.stringify(outcome.body));return;
  }
  res.writeHead(404).end();
 }catch{res.writeHead(500).end()}
});
await new Promise((ok,fail)=>{server.once('error',fail);server.listen(47835,'127.0.0.1',ok)});
const request=(path,options)=>fetch(base+path,options);
const cookies=[];
try{
 for(let i=0;i<3;i++){
  const p=testUsers[i];
  const signin=await request('/api/auth/sign-in/email',{method:'POST',headers:{'origin':base,'content-type':'application/json'},body:JSON.stringify({email:p.email,password:p.password})});
  if(!signin.ok)throw Error('LOGIN_FAIL_'+(i+1));
  const cookie=(signin.headers.getSetCookie?.()||[]).filter(x=>x.includes('session_token')).map(x=>x.split(';')[0]).join('; ');
  if(!cookie)throw Error('NO_SESSION_COOKIE_'+(i+1));
  cookies.push(cookie);
 }
 const aHost=testUsers[0],bHost=testUsers[1],aCookie=cookies[0],bCookie=cookies[1];
 const url='/api/hosts/'+aHost.host_id+'/reservations';
 const payload={roomId:aHost.room_id,checkIn:'2099-07-10',checkOut:'2099-07-12',status:'confirmed'};
 let bookingId;
 try{
  const create=await request(url,{method:'POST',headers:{cookie:aCookie,'origin':base,'content-type':'application/json'},body:JSON.stringify(payload)});
  const created=await create.json();
  if(create.status!==201||!created.reservation?.id)throw Error('BOOKING_CREATE_HTTP_'+create.status);
  bookingId=created.reservation.id;
  console.log('HTTP_BOOKING_CREATE_PASS');
  const own=await request(url,{headers:{cookie:aCookie}});
  const ownData=await own.json();
  if(own.status!==200||!ownData.reservations.some(x=>x.id===bookingId))throw Error('OWNER_HTTP_READ_FAILED');
  console.log('HTTP_OWNER_READ_PASS');
  const foreign=await request(url,{headers:{cookie:bCookie}});
  const foreignData=await foreign.json();
  if(foreign.status!==200||foreignData.reservations.some(x=>x.id===bookingId))throw Error('CROSS_TENANT_READ_FAILED');
  console.log('HTTP_CROSS_TENANT_READ_BLOCKED_PASS');
  const patch=await request(url+'/'+bookingId,{method:'PATCH',headers:{cookie:aCookie,'origin':base,'content-type':'application/json'},body:JSON.stringify({...payload,status:'pending',version:1})});
  if(patch.status!==200)throw Error('OWNER_PATCH_'+patch.status);
  console.log('HTTP_BOOKING_PATCH_PASS');
  const attempted=await request(url+'/'+bookingId,{method:'DELETE',headers:{cookie:bCookie,'origin':base}});
  if(attempted.status!==404)throw Error('CROSS_TENANT_DELETE_'+attempted.status);
  console.log('HTTP_CROSS_TENANT_DELETE_BLOCKED_PASS');
  console.log('HTTP_RESERVATIONS_PASS');
 }finally{
  if(bookingId){
   const clean=await request(url+'/'+bookingId,{method:'DELETE',headers:{cookie:aCookie,'origin':base}});
   console.log(clean.ok?'TEST_BOOKING_CLEANED':'TEST_BOOKING_CLEANUP_REQUIRED');
  }
 }
}catch(e){console.log('HTTP_RESERVATIONS_FAILED',e?.message||'UNKNOWN');process.exitCode=1}
finally{await new Promise(resolve=>server.close(resolve));await booking.end();await lookup.end()}
