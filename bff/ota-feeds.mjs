import crypto from 'node:crypto';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function validId(id){return typeof id==='string'&&uuid.test(id)}
export function normalizeOtaUrl(raw,provider){
 if(!['airbnb','booking'].includes(provider)||typeof raw!=='string'||raw.length>2048)throw Error('INVALID_OTA_SOURCE');
 const input=raw.trim().replace(/^webcal:\/\//i,'https://');
 let u;try{u=new URL(input)}catch{throw Error('INVALID_OTA_URL')}
 if(u.protocol!=='https:'||u.username||u.password||u.port||u.hash)throw Error('INVALID_OTA_URL');
 const host=u.hostname.toLowerCase();
 const domains=provider==='airbnb'?['airbnb.com','airbnb.co.kr']:['booking.com'];
 if(!domains.some(d=>host===d||host.endsWith('.'+d)))throw Error('INVALID_OTA_DOMAIN');
 return u.toString();
}
function getKey(){
 const b64=process.env.STAYBLOCK_OTA_ENCRYPTION_KEY;
 if(typeof b64!=='string')throw Error('OTA_ENCRYPTION_KEY_NOT_CONFIGURED');
 const b=Buffer.from(b64,'base64');
 if(b.length!==32)throw Error('OTA_ENCRYPTION_KEY_INVALID');
 return b;
}
export function seal(url,hostId,roomId,provider){
 const nonce=crypto.randomBytes(12),cipher=crypto.createCipheriv('aes-256-gcm',getKey(),nonce);
 cipher.setAAD(Buffer.from([hostId,roomId,provider].join('|')));
 const encrypted=Buffer.concat([cipher.update(url,'utf8'),cipher.final()]);
 return {url_ciphertext:encrypted.toString('base64'),url_nonce:nonce.toString('base64'),url_tag:cipher.getAuthTag().toString('base64')};
}
export function openFeed(row){
 const decipher=crypto.createDecipheriv('aes-256-gcm',getKey(),Buffer.from(row.url_nonce,'base64'));
 decipher.setAAD(Buffer.from([row.host_id,row.room_id,row.provider].join('|')));
 decipher.setAuthTag(Buffer.from(row.url_tag,'base64'));
 return Buffer.concat([decipher.update(Buffer.from(row.url_ciphertext,'base64')),decipher.final()]).toString('utf8');
}
export async function fetchCalendar(url){
 const abort=new AbortController(),timer=setTimeout(()=>abort.abort(),12000);
 try{
  const res=await fetch(url,{redirect:'manual',signal:abort.signal,headers:{accept:'text/calendar,text/plain;q=0.9','user-agent':'StayBlock-Calendar/0.2'}});
  if(res.status>=300&&res.status<400)throw Error('OTA_REDIRECT_BLOCKED');
  if(!res.ok)throw Error('OTA_FETCH_FAILED');
  if(Number(res.headers.get('content-length')||0)>400000)throw Error('OTA_FILE_TOO_LARGE');
  let bytes=0;const parts=[];
  for await(const chunk of res.body){bytes+=chunk.length;if(bytes>400000)throw Error('OTA_FILE_TOO_LARGE');parts.push(chunk)}
  return new TextDecoder().decode(Buffer.concat(parts));
 }finally{clearTimeout(timer)}
}
