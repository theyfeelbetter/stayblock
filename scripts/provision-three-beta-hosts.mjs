#!/usr/bin/env node
/**
 * OWNER-ONLY local provisioning for EXACTLY three fictional beta tenants.
 * Run from a trusted terminal; NEVER configure ADMIN_DATABASE_URL on Vercel,
 * never check host identities, initial passwords, or admin URL into Git.
 * Usage: ADMIN_DATABASE_URL=... node scripts/provision-three-beta-hosts.mjs ./private-hosts.json
 * Input JSON: [{"email":"...","name":"...","property":"...","room":"..."} x3]
 * Reads password input from a private local file specified by STAYBLOCK_PASSWORD_FILE:
 *   [{"email":"...","password":"unique-long-password"} x3].
 * Never logs raw data, secrets or password hashes. Does not auto-invite or send email.
 */
import fs from 'node:fs';
import crypto from 'node:crypto';
import pg from 'pg';
import {hashPassword} from 'better-auth/crypto';

const input=process.argv[2],url=process.env.ADMIN_DATABASE_URL,passFile=process.env.STAYBLOCK_PASSWORD_FILE;
if(!input||!url||!passFile)throw Error('LOCAL_OWNER_CONFIG_REQUIRED');
if(process.env.VERCEL||process.env.CI)throw Error('LOCAL_ONLY_NOT_CI_OR_VERCEL');
const u=new URL(url);
if(!['postgresql:','postgres:'].includes(u.protocol)||!u.hostname.endsWith('.neon.tech')||!['require','verify-full'].includes(u.searchParams.get('sslmode'))||u.username!=='neondb_owner')throw Error('OWNER_DEV_DB_REQUIRED');
if(process.env.EXPECTED_DEV_DATABASE_HOST!==u.hostname)throw Error('EXACT_DEVELOPMENT_DB_HOST_REQUIRED');
const users=JSON.parse(fs.readFileSync(input,'utf8')),pws=JSON.parse(fs.readFileSync(passFile,'utf8'));
const norm=s=>String(s||'').trim();
if(!Array.isArray(users)||users.length!==3||!Array.isArray(pws)||pws.length!==3)throw Error('EXACTLY_THREE_REQUIRED');
const emails=new Set();
for(const x of users){
 x.email=norm(x.email).toLowerCase();
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(x.email)||emails.has(x.email))throw Error('INVALID_OR_DUPLICATE_EMAIL');
 emails.add(x.email);
 for(const k of ['name','property','room'])if(norm(x[k]).length<2||norm(x[k]).length>100)throw Error('INVALID_'+k);
 const secret=pws.find(y=>norm(y.email).toLowerCase()===x.email)?.password;
 if(typeof secret!=='string'||secret.length<16||secret.length>256)throw Error('STRONG_UNIQUE_PASSWORD_REQUIRED');
}
if(new Set(pws.map(y=>y.password)).size!==3)throw Error('PASSWORDS_MUST_BE_DIFFERENT');
if(process.env.STAYBLOCK_OWNER_CONFIRM!=='PROVISION_3_DEV_HOSTS')throw Error('CONFIRM_DEV_ONLY');
const pool=new pg.Pool({connectionString:url,ssl:{rejectUnauthorized:true},max:1});
const client=await pool.connect();
try{
 await client.query('BEGIN');
 const role=await client.query('SELECT current_user AS name');
 if(role.rows[0]?.name!=='neondb_owner')throw Error('OWNER_ROLE_REQUIRED');
 const count=await client.query('SELECT (SELECT count(*) FROM stayblock_auth."user")::int AS users, (SELECT count(*) FROM stayblock.hosts)::int AS hosts');
 if(count.rows[0].users!==0||count.rows[0].hosts!==0)throw Error('EXPECTED_EMPTY_DEVELOPMENT_DB');
 for(const x of users){
  const password=pws.find(y=>norm(y.email).toLowerCase()===x.email).password;
  const id=crypto.randomUUID(),host=crypto.randomUUID(),prop=crypto.randomUUID(),room=crypto.randomUUID();
  const hashed=await hashPassword(password);
  await client.query('INSERT INTO stayblock_auth."user"(id,name,email,"emailVerified") VALUES($1,$2,$3,false)',[id,x.name,x.email]);
  await client.query('INSERT INTO stayblock_auth."account"(id,"accountId","providerId","userId",password) VALUES($1,$2,$3,$4,$5)',[crypto.randomUUID(),id,'credential',id,hashed]);
  await client.query('INSERT INTO stayblock.hosts(id,name) VALUES($1,$2)',[host,x.name+' (TEST)']);
  await client.query('INSERT INTO stayblock.memberships(host_id,user_id,role,active) VALUES($1,$2,$3,true)',[host,id,'owner']);
  await client.query('INSERT INTO stayblock.properties(id,host_id,name) VALUES($1,$2,$3)',[prop,host,x.property+' (TEST)']);
  await client.query('INSERT INTO stayblock.rooms(id,host_id,property_id,name) VALUES($1,$2,$3,$4)',[room,host,prop,x.room]);
 }
 await client.query('COMMIT');
 process.stdout.write('PROVISIONED_THREE_SYNTHETIC_TENANTS; distribute passwords individually through approved secure channel; no real guest data.\n');
}catch(e){await client.query('ROLLBACK');throw Error('PROVISION_FAILED: '+String(e?.message||'unknown').replace(/postgresql?:\/\/[^\s]+/g,'[redacted]'))}
finally{client.release();await pool.end()}
