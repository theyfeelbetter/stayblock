#!/usr/bin/env node
// Applies ONLY the vetted OTA feeds migration to the verified development database.
import fs from 'node:fs';
import pg from 'pg';
const dir=process.env.HOME+'/stayblock-private/';
if(process.env.CI||process.env.VERCEL)throw Error('LOCAL_ONLY');
const owner=fs.readFileSync(dir+'neon-dev-uri','utf8').trim(),runtime=fs.readFileSync(dir+'neon-http-uri','utf8').trim();
const a=new URL(owner),b=new URL(runtime);
if(a.username!=='neondb_owner'||b.username!=='stayblock_http'||a.hostname!==b.hostname||a.pathname!==b.pathname||a.hostname.includes('-pooler'))throw Error('DEVELOPMENT_DATABASE_MISMATCH');
if(process.env.EXPECTED_DEV_DATABASE_HOST!==a.hostname)throw Error('EXPECTED_DEV_HOST_REQUIRED');
if(process.env.STAYBLOCK_OTA_MIGRATE_CONFIRM!=='OTA_DEVELOPMENT_ONLY')throw Error('EXPLICIT_DEV_CONFIRM_REQUIRED');
const db=new pg.Client({connectionString:owner,ssl:{rejectUnauthorized:true}});
try{
 await db.connect();
 const count=await db.query('SELECT (SELECT count(*) FROM stayblock.hosts)::int AS hosts,(SELECT count(*) FROM stayblock_auth."user")::int AS users');
 if(count.rows[0].hosts!==3||count.rows[0].users!==3)throw Error('EXPECTED_THREE_TEST_HOSTS');
 await db.query('BEGIN');
 try{await db.query(fs.readFileSync(new URL('../db/neon/0004_ota_feeds.sql',import.meta.url),'utf8'));await db.query('COMMIT')}
 catch(e){await db.query('ROLLBACK');throw e}
 console.log('OTA_DEV_MIGRATION_APPLIED');
 const result=await db.query("SELECT count(*)::int AS feeds FROM stayblock.ota_feeds");
 console.log('FEEDS:',result.rows[0].feeds);
}catch(e){console.log('OTA_MIGRATION_FAILED:',e.code||e.message);process.exitCode=1}
finally{await db.end().catch(()=>{})}
