import {auth} from '../../auth.config.mjs';
import pg from 'pg';
import {createRequire} from 'node:module';
import {parseIcs,compareIcs} from '../../ui/ical-preview.mjs';
const require=createRequire(import.meta.url);
const {assertDbTarget}=require('../../bff/deployment-readiness.cjs');
const {withVerifiedDbSession}=require('../../bff/verified-db-session.cjs');
const uuid=/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i;
let pool;
function allowed(raw){
 if(typeof raw!=='string'||raw.length>2048)throw Error('INVALID_URL');
 const input=raw.trim().replace(/^webcal:\/\//i,'https://');
 let url;try{url=new URL(input)}catch{throw Error('INVALID_URL')}
 if(url.protocol!=='https:'||url.username||url.password||url.port||url.hash)throw Error('INVALID_URL');
 const host=url.hostname.toLowerCase();
 const endings=['airbnb.com','airbnb.co.kr','booking.com'];
 if(!endings.some(domain=>host===domain||host.endsWith('.'+domain)))throw Error('UNSUPPORTED_OTA_DOMAIN');
 return url.toString();
}
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(process.env.STAYBLOCK_BETA_API_ENABLED!=='true')return res.status(503).json({error:'BETA_API_DISABLED'});
 if(req.method!=='POST')return res.status(405).json({error:'METHOD_NOT_ALLOWED'});
 const roomId=req.body?.roomId,hostId=req.body?.hostId;
 if(typeof hostId!=='string'||!uuid.test(hostId)||typeof roomId!=='string'||!uuid.test(roomId))return res.status(400).json({error:'INVALID_ROOM'});
 let source;
 try{source=allowed(req.body?.url)}catch(e){return res.status(400).json({error:e.message})}
 try{
  assertDbTarget(process.env);
  pool??=new pg.Pool({connectionString:process.env.DATABASE_URL,max:3,ssl:{rejectUnauthorized:true}});
  const allowedRoom=await withVerifiedDbSession({auth,headers:new Headers(req.headers),pool,work:async db=>{
   const rooms=await db.query('SELECT id FROM stayblock.rooms WHERE id=$1 AND host_id=$2',[roomId,hostId]);
   if(rooms.rowCount!==1)return null;
   const bookings=await db.query('SELECT room_id,check_in,check_out,status FROM stayblock.reservations WHERE host_id=$1 AND room_id=$2 LIMIT 500',[hostId,roomId]);
   return bookings.rows;
  }});
  if(!allowedRoom)return res.status(403).json({error:'ROOM_ACCESS_DENIED'});
  const abort=new AbortController();
  const timer=setTimeout(()=>abort.abort(),12000);
  let data;
  try{
   const response=await fetch(source,{redirect:'manual',signal:abort.signal,headers:{'accept':'text/calendar, text/plain;q=0.9','user-agent':'StayBlock-iCal-Preview/1.0'}});
   if(!response.ok)return res.status(502).json({error:'OTA_FETCH_FAILED',status:response.status});
   if(response.status>=300&&response.status<400)return res.status(502).json({error:'OTA_REDIRECT_NOT_ALLOWED'});
   const len=Number(response.headers.get('content-length')||0);
   if(len>400000)return res.status(413).json({error:'ICAL_TOO_LARGE'});
   const reader=response.body.getReader();const chunks=[];let size=0;
   while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>400000){await reader.cancel();return res.status(413).json({error:'ICAL_TOO_LARGE'})}chunks.push(value)}
   const merged=new Uint8Array(size);let pos=0;for(const chunk of chunks){merged.set(chunk,pos);pos+=chunk.byteLength}
   data=new TextDecoder().decode(merged);
  }finally{clearTimeout(timer)}
  const parsed=parseIcs(data);
  const checked=compareIcs(parsed.events,allowedRoom,roomId);
  return res.status(200).json({count:checked.length,conflicts:checked.filter(x=>x.conflict).length,skipped:parsed.skipped,events:checked.slice(0,100).map(x=>({start:x.start,end:x.end,conflict:x.conflict})),persisted:false});
 }catch(e){
  if(e?.message==='UNAUTHENTICATED')return res.status(401).json({error:'UNAUTHENTICATED'});
  return res.status(502).json({error:'OTA_PREVIEW_FAILED'});
 }
}
