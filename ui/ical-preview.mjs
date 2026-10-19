// Read-only iCalendar availability import preview. No network requests or DB writes.
const day = v => /^\d{8}$/.test(v) ? v.slice(0,4)+'-'+v.slice(4,6)+'-'+v.slice(6,8) : null;
export function parseIcs(text) {
 if(typeof text!=='string'||text.length>400000||!text.includes('BEGIN:VCALENDAR'))throw Error('INVALID_ICALENDAR');
 const lines=text.replace(/\r\n?/g,'\n').split('\n').reduce((out,line)=>{if(/^[ \t]/.test(line)&&out.length)out[out.length-1]+=line.slice(1);else out.push(line);return out},[]);
 let current=null;const events=[];let skipped=0;
 for(const line of lines){
  if(line==='BEGIN:VEVENT'){current={};continue}
  if(line==='END:VEVENT'){
   if(current){
    const start=day(current.DTSTART),end=day(current.DTEND);
    if(start&&end&&end>start&&current.UID&&!current.RRULE&&current.STATUS!=='CANCELLED'){
     events.push({uid:current.UID,start,end,summary:current.SUMMARY||'OTA 차단'});
    }else skipped++;
   }current=null;continue;
  }
  if(!current)continue;
  const index=line.indexOf(':');if(index<0)continue;
  const key=line.slice(0,index).split(';')[0].toUpperCase();
  if(['UID','DTSTART','DTEND','SUMMARY','STATUS','RRULE'].includes(key))current[key]=line.slice(index+1).trim();
 }
 if(events.length>2000)throw Error('TOO_MANY_EVENTS');
 return {events,skipped};
}
export function compareIcs(events,bookings,roomId){
 return events.map(event=>({...event,conflict:bookings.some(b=>b.room_id===roomId&&b.status!=='cancelled'&&String(b.check_in).slice(0,10)<event.end&&event.start<String(b.check_out).slice(0,10))}));
}
