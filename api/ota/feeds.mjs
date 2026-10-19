import {auth} from '../../auth.config.mjs';
import pg from 'pg';
import {createRequire} from 'node:module';
import {parseIcs,compareIcs} from '../../ui/ical-preview.mjs';
import {validId,normalizeOtaUrl,seal,openFeed,fetchCalendar} from '../../bff/ota-feeds.mjs';
const require=createRequire(import.meta.url);
const {assertDbTarget}=require('../../bff/deployment-readiness.cjs');
const {withVerifiedDbSession}=require('../../bff/verified-db-session.cjs');
let pool;
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(process.env.STAYBLOCK_BETA_API_ENABLED!=='true')return res.status(503).json({error:'BETA_API_DISABLED'});
 if(!['GET','POST','PUT','DELETE'].includes(req.method))return res.status(405).json({error:'METHOD_NOT_ALLOWED'});
 const hostId=req.method==='GET'?req.query?.hostId:req.body?.hostId;
 if(!validId(hostId))return res.status(400).json({error:'INVALID_HOST_ID'});
 try{
  assertDbTarget(process.env);
  pool??=new pg.Pool({connectionString:process.env.DATABASE_URL,max:3,ssl:{rejectUnauthorized:true}});
  // No network call before RLS confirms the caller's room/feed access.
  if(req.method==='GET'){
   const feeds=await withVerifiedDbSession({auth,pool,headers:new Headers(req.headers),work:async db=>{
    const r=await db.query('SELECT id,room_id,provider,last_checked_at,last_error FROM stayblock.ota_feeds WHERE host_id=$1 ORDER BY provider,created_at',[hostId]);return r.rows;
   }});
   return res.status(200).json({feeds});
  }
  if(req.method==='POST'){
   const roomId=req.body?.roomId,provider=req.body?.provider;
   if(!validId(roomId))return res.status(400).json({error:'INVALID_ROOM_ID'});
   const url=normalizeOtaUrl(req.body?.url,provider);
   const enc=seal(url,hostId,roomId,provider);
   const data=await withVerifiedDbSession({auth,pool,headers:new Headers(req.headers),work:async db=>{
    const room=await db.query('SELECT id FROM stayblock.rooms WHERE id=$1 AND host_id=$2',[roomId,hostId]);
    if(room.rowCount!==1)return null;
    const saved=await db.query(`INSERT INTO stayblock.ota_feeds(host_id,room_id,provider,url_ciphertext,url_nonce,url_tag)
 VALUES($1,$2,$3,$4,$5,$6)
 ON CONFLICT(room_id,provider) DO UPDATE SET url_ciphertext=EXCLUDED.url_ciphertext,url_nonce=EXCLUDED.url_nonce,url_tag=EXCLUDED.url_tag,updated_at=now(),last_checked_at=NULL,last_error=NULL
 RETURNING id,room_id,provider,last_checked_at`,[hostId,roomId,provider,enc.url_ciphertext,enc.url_nonce,enc.url_tag]);
    return saved.rows[0];
   }});
   return data?res.status(200).json({feed:data}):res.status(403).json({error:'ROOM_ACCESS_DENIED'});
  }
  const feedId=req.body?.feedId;
  if(!validId(feedId))return res.status(400).json({error:'INVALID_FEED_ID'});
  if(req.method==='DELETE'){
   const deleted=await withVerifiedDbSession({auth,pool,headers:new Headers(req.headers),work:async db=>{
    const r=await db.query('DELETE FROM stayblock.ota_feeds WHERE id=$1 AND host_id=$2 RETURNING id',[feedId,hostId]);return r.rowCount;
   }});
   return res.status(deleted?200:404).json({deleted:!!deleted});
  }
  const record=await withVerifiedDbSession({auth,pool,headers:new Headers(req.headers),work:async db=>{
   const r=await db.query('SELECT * FROM stayblock.ota_feeds WHERE id=$1 AND host_id=$2',[feedId,hostId]);if(r.rowCount!==1)return null;
   const b=await db.query('SELECT room_id,check_in,check_out,status FROM stayblock.reservations WHERE room_id=$1 AND host_id=$2 LIMIT 500',[r.rows[0].room_id,hostId]);
   return {feed:r.rows[0],bookings:b.rows};
  }});
  if(!record)return res.status(404).json({error:'FEED_NOT_FOUND'});
  // Validate decrypted URL anew, then fetch. Never return the raw URL or event summaries.
  const source=normalizeOtaUrl(openFeed(record.feed),record.feed.provider);
  let parsed;
  try{parsed=parseIcs(await fetchCalendar(source))}catch(e){return res.status(502).json({error:['OTA_FETCH_FAILED','OTA_FILE_TOO_LARGE','OTA_REDIRECT_BLOCKED'].includes(e.message)?e.message:'OTA_SYNC_FAILED'})}
  const events=compareIcs(parsed.events,record.bookings,record.feed.room_id);
  await withVerifiedDbSession({auth,pool,headers:new Headers(req.headers),work:async db=>{
   await db.query('UPDATE stayblock.ota_feeds SET last_checked_at=now(),last_error=NULL WHERE id=$1 AND host_id=$2',[feedId,hostId]);
  }});
  return res.status(200).json({feedId,roomId:record.feed.room_id,provider:record.feed.provider,count:events.length,conflicts:events.filter(x=>x.conflict).length,skipped:parsed.skipped,events:events.slice(0,100).map(x=>({start:x.start,end:x.end,conflict:x.conflict})),persisted:false});
 }catch(e){
  if(e?.message==='UNAUTHENTICATED')return res.status(401).json({error:'UNAUTHENTICATED'});
  if(e?.message?.startsWith('INVALID_OTA'))return res.status(400).json({error:e.message});
  return res.status(503).json({error:'OTA_FEEDS_NOT_READY'});
 }
}
