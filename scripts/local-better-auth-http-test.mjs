#!/usr/bin/env node
// Local-only Better Auth HTTP E2E, against Neon development authentication tables.
import fs from 'node:fs';
import crypto from 'node:crypto';
import http from 'node:http';
import pg from 'pg';
import {betterAuth} from 'better-auth';
const privateDir=process.env.HOME+'/stayblock-private/';
if(process.env.VERCEL||process.env.CI)throw Error('LOCAL_ONLY');
const adminUrl=fs.readFileSync(privateDir+'neon-dev-uri','utf8').trim();
const accounts=JSON.parse(fs.readFileSync(privateDir+'host-passwords.json','utf8'));
if(!Array.isArray(accounts)||accounts.length!==3)throw Error('THREE_ACCOUNTS_REQUIRED');
const u=new URL(adminUrl);
if(u.username!=='neondb_owner'||!u.hostname.endsWith('.neon.tech')||u.hostname.includes('-pooler'))throw Error('DEV_OWNER_DIRECT_URI_REQUIRED');
if(process.env.EXPECTED_DEV_DATABASE_HOST!==u.hostname)throw Error('EXPECTED_DEV_HOST_MISMATCH');
const auth=betterAuth({
 baseURL:'http://127.0.0.1:47831',
 secret:crypto.randomBytes(48).toString('base64url'),
 database:new pg.Pool({connectionString:adminUrl,options:'-c search_path=stayblock_auth',ssl:{rejectUnauthorized:true},max:2}),
 emailAndPassword:{enabled:true,disableSignUp:true},
 trustedOrigins:['http://127.0.0.1:47831'],
 session:{expiresIn:60*60,updateAge:60*30}
});
const server=http.createServer(async(req,res)=>{
 try{
  let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>15000){res.writeHead(413).end();return}}
  const url=new URL(req.url,'http://127.0.0.1:47831');
  const request=new Request(url,{method:req.method,headers:new Headers(req.headers),body:['GET','HEAD'].includes(req.method)?undefined:raw});
  const response=await auth.handler(request);
  res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));
 }catch{res.writeHead(500,{'content-type':'application/json'});res.end('{}')}
});
await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(47831,'127.0.0.1',resolve)});
const root='http://127.0.0.1:47831';
const request=async(path,opts={})=>fetch(root+path,opts);
try{
 for(let i=0;i<accounts.length;i++){
  const account=accounts[i];
  const res=await request('/api/auth/sign-in/email',{method:'POST',headers:{'content-type':'application/json','origin':root},body:JSON.stringify({email:account.email,password:account.password})});
  const cookies=res.headers.getSetCookie?.()||[];
  const sessionCookies=cookies.filter(x=>/session_token/.test(x));
  if(!res.ok||sessionCookies.length===0){console.log('HOST_'+(i+1)+'_LOGIN_FAIL HTTP_'+res.status);continue}
  const cookie=sessionCookies.map(x=>x.split(';')[0]).join('; ');
  const current=await request('/api/auth/get-session',{headers:{cookie,origin:root}});
  const data=await current.json().catch(()=>null);
  if(!current.ok||data?.user?.email!==account.email){console.log('HOST_'+(i+1)+'_SESSION_FAIL');continue}
  const out=await request('/api/auth/sign-out',{method:'POST',headers:{cookie,origin:root,'content-type':'application/json'},body:'{}'});
  console.log('HOST_'+(i+1)+'_LOGIN_SESSION_'+(out.ok?'LOGOUT_OK':'LOGOUT_FAIL'));
 }
}catch(e){console.log('HTTP_AUTH_TEST_ERROR',e?.name||'UNKNOWN')}
finally{server.close();await auth.options.database.end()}
