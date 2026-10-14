const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const root=path.join(__dirname,'..');
const source=f=>fs.readFileSync(path.join(root,f),'utf8');
const scripts=f=>[...source(f).matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(m=>m[1]);
function harness(file='app.html',initial={}){
  const data=new Map(Object.entries(initial)), elements=new Map(), writes=[], timers=[], downloads=[];
  const el=id=>{if(!elements.has(id))elements.set(id,{value:'',textContent:'',innerHTML:'',style:{setProperty(){}},dataset:{},classList:{add(){},remove(){},toggle(){}},addEventListener(){},focus(){},select(){},click(){downloads.push(this);}});return elements.get(id);};
  const ctx={Date,Math,JSON,URLSearchParams,Blob,Uint8Array,crypto:require('node:crypto').webcrypto,
    URL:{createObjectURL(blob){ctx.lastBlob=blob;return 'blob:audit';},revokeObjectURL(){}},
    localStorage:{getItem:k=>data.get(k)??null,setItem:(k,v)=>{writes.push(k);data.set(k,v);},removeItem:k=>{writes.push(k);data.delete(k);}},
    document:{getElementById:el,querySelectorAll:()=>[],querySelector:()=>null,addEventListener(){},createElement:()=>el('download')},
    location:{href:'',origin:'https://audit.invalid',pathname:'/app.html',search:'?paid=1&plan=monthly'},
    navigator:{clipboard:{writeText(){throw Error('unavailable export copied');}}},
    setTimeout:fn=>{timers.push(fn);return 0;},alert:m=>{throw Error(m);},confirm:()=>true,fetch:()=>{throw Error('network forbidden');},atob,btoa};
  ctx.window=ctx;vm.createContext(ctx);scripts(file).forEach(s=>vm.runInContext(s,ctx));
  return {ctx,data,writes,timers,downloads,el,run:s=>vm.runInContext(s,ctx)};
}
const user=(days,plan)=>({name:'Audit',email:'audit@example.invalid',joinedAt:new Date(Date.now()-days*86400000).toISOString(),plan});
const initial=u=>({sb_session:JSON.stringify({name:u.name,email:u.email}),sb_users:JSON.stringify([u])});
for(const f of ['index.html','app.html','pricing.html','invite.html'])test(`syntax ${f}`,()=>scripts(f).forEach(s=>new vm.Script(s)));
for(const days of [0,29,30,365])test(`free room and reservation CRUD at day ${days}`,()=>{
  const h=harness('app.html',initial(user(days)));h.run('openMyPage();openAddMo();');
  assert.equal(h.ctx.location.href,'');assert.equal(h.el('mp-plan-name').textContent,'Host Free Beta');
  h.el('f-name').value='Synthetic';h.el('f-cin').value='2026-10-14';h.el('f-cout').value='2026-10-16';h.el('f-room').value='Room A';h.el('f-status').value='confirmed';
  h.run('saveRes()');assert.equal(JSON.parse(h.data.get('sb3r')).length,1);
  h.run('openEditMo(1)');h.el('f-name').value='Changed';h.run('saveRes()');assert.equal(JSON.parse(h.data.get('sb3r'))[0].name,'Changed');
  h.run('openEditMo(1);delRes()');assert.deepEqual(JSON.parse(h.data.get('sb3r')),[]);
  // Existing room edit handlers can still add/save a room, without plan gating.
  h.ctx.document.querySelectorAll=q=>q==='#roomEditList input'?[{value:'Audit room',focus(){},select(){}}]:[];
  h.run('addRoomSlot();saveRoomNames()');assert.deepEqual(JSON.parse(h.data.get('sb3rooms')).rooms,['Audit room']);
  assert.equal(h.ctx.location.href,'');
});
test('load preserves all existing records including legacy plans and mock metadata',()=>{
  const before={...initial(user(365,'yearly')),sb3r:JSON.stringify([{id:42,name:'Existing',room:'Room A',cin:'2026-10-14',cout:'2026-10-16'}]),sb3rooms:JSON.stringify({rooms:['Room A'],roomColors:['#bbdefb']}),sb3f:JSON.stringify([{name:'Old',url:'sample://old'}]),sb_via_props:JSON.stringify([{name:'Legacy',exportToken:'synthetic',syncStatus:'ok',syncCount:9,lastSynced:'2020-01-01'}]),sb_invites:'[]',sb_prop:'{}'};
  const h=harness('app.html',before);h.run('openMyPage();renderSyncLogs();loadSample("airbnb");runSyncAll();copyExportUrl();openViaPropMo(0)');
  assert.deepEqual(Object.fromEntries(h.data),before);assert.deepEqual(h.writes,[]);
  assert.match(h.el('syncInLog').textContent,/미제공/);assert.doesNotMatch(h.el('vp-export-url').textContent,/synthetic|https:/);
});
test('empty host dataset and sample preview never seed bookings',()=>{const h=harness('app.html',initial(user(0)));h.run('loadSample("booking")');assert.equal(h.run('reservations.length'),0);assert.equal(h.data.has('sb3r'),false);assert.deepEqual(h.writes,[]);assert.match(h.el('icalRes').textContent,/데모/);});
test('explicit reset stays empty rather than reseeding demo',()=>{const h=harness('app.html',{...initial(user(0)),sb3r:'[]'});h.run('clearAllData()');assert.deepEqual(JSON.parse(h.data.get('sb3r')),[]);});
test('paid query cannot modify legacy entitlement on pricing or app',()=>{for(const f of ['pricing.html','app.html']){const before=initial(user(365));const h=harness(f,before);assert.deepEqual(Object.fromEntries(h.data),before);assert.deepEqual(h.writes,[]);}});
test('supported simple ICS import is idempotent and CSV exports it',async()=>{
  const h=harness('app.html',initial(user(365)));h.ctx.fixture='BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nUID:audit-1\r\nDTSTART;VALUE=DATE:20261014\r\nDTEND;VALUE=DATE:20261016\r\nSUMMARY:Audit booking\r\nEND:VEVENT\r\nEND:VCALENDAR';
  h.run('applyParsed(parseICS(fixture,"Audit","Room A"),"Audit","file://Audit");applyParsed(parseICS(fixture,"Audit","Room A"),"Audit","file://Audit");exportCSV()');
  assert.equal(JSON.parse(h.data.get('sb3r')).length,1);assert.match(await h.ctx.lastBlob.text(),/Audit booking/);assert.equal(h.downloads.length,1);
});
test('individual invitation ICS remains available',()=>{const h=harness('invite.html');h.ctx.inv={id:'audit',type:'custom',title:'Audit',date:'2026-10-14',startTime:'10:00',endTime:'11:00'};assert.match(h.run('makeICS(inv)'),/BEGIN:VEVENT/);assert.match(h.run('makeICS(inv)'),/DTEND;VALUE=DATE-TIME:20261014T110000/);});
test('no paid gating or fake success endpoint remains in user pages',()=>{const all=['index.html','app.html','pricing.html','invite.html'].map(source).join('\n');assert.doesNotMatch(all,/TRIAL_DAYS|lockExpired|getTrialStatus|subscribePremium|STRIPE_LINKS|export-ical\.ics|paid['"]?\)\s*===|30일|알림이 전송됩니다|마지막 동기화 5분 전/);assert.match(source('index.html'),/데모 — 읽기 전용/);});
