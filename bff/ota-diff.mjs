// Pure read-only OTA change detection. No database or OTA writes.
const key=e=>String(e.uid||'').trim();
export function diffOtaEvents(previous,current){
 const old=new Map(),next=new Map();
 for(const e of previous){if(!key(e))continue;if(old.has(key(e)))throw Error('DUPLICATE_PREVIOUS_UID');old.set(key(e),e)}
 for(const e of current){if(!key(e))continue;if(next.has(key(e)))throw Error('DUPLICATE_CURRENT_UID');next.set(key(e),e)}
 const added=[],changed=[],missing=[],unchanged=[];
 for(const [uid,event] of next){
  const prior=old.get(uid);
  if(!prior)added.push({uid,start:event.start,end:event.end});
  else if(prior.start!==event.start||prior.end!==event.end)changed.push({uid,before:{start:prior.start,end:prior.end},after:{start:event.start,end:event.end}});
  else unchanged.push(uid);
 }
 for(const [uid,event] of old)if(!next.has(uid))missing.push({uid,start:event.start,end:event.end});
 return {added,changed,missing,unchangedCount:unchanged.length};
}
// Missing is NOT interpreted as cancelled without successful complete feed retrieval
// and a provider-specific confirmation policy.
