'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),http=require('node:http');
const {handleReservationApi}=require('../bff/beta-reservations.cjs');
const A='11111111-1111-4111-8111-111111111111',B='22222222-2222-4222-8222-222222222222';
const ROOM='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const payload={roomId:ROOM,checkIn:'2026-10-20',checkOut:'2026-10-22',status:'confirmed'};
function context(){
 const observed=[];
 const auth={api:{getSession:async({headers})=>{const who=headers.get('x-test-user');return who?{user:{id:who}}:null}}};
 const pool={connect:async()=>({
  query:async(sql,args=[])=>{
   observed.push({sql,args});
   if(sql==='SELECT current_user AS db_role')return {rows:[{db_role:'stayblock_runtime'}]};
   if(sql.includes('FROM stayblock.reservations')){
    const current=observed.findLast(q=>q.sql.includes('set_config'))?.args?.[0];
    return {rows:current==='fixture-user-a'&&args[0]===A?[{id:ROOM,room_id:ROOM}]:[],rowCount:current==='fixture-user-a'&&args[0]===A?1:0};
   }
   if(sql.startsWith('INSERT INTO stayblock.reservations')){
    const current=observed.findLast(q=>q.sql.includes('set_config'))?.args?.[0];
    if(current!=='fixture-user-a'||args[0]!==A) {const e=new Error('RLS violation');e.code='42501';throw e;}
    return {rows:[{id:ROOM}],rowCount:1};
   }
   return {rows:[],rowCount:0};
  },release:()=>{}
 })};
 return {auth,pool,observed};
}
async function serverTest(path,user,method='GET',body){
 const deps=context();
 const server=http.createServer(async(req,res)=>{
  const input=await new Promise(resolve=>{let data='';req.on('data',c=>data+=c);req.on('end',()=>resolve(data?JSON.parse(data):null))});
  const result=await handleReservationApi({...deps,headers:new Headers({'x-test-user':req.headers['x-test-user']||''}),method:req.method,hostId:req.url.split('/')[2],body:input});
  res.writeHead(result.status,{'Content-Type':'application/json'});res.end(JSON.stringify(result.body));
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 try {const response=await fetch('http://127.0.0.1:'+server.address().port+path,{method,headers:{'x-test-user':user||'','content-type':'application/json'},body:body?JSON.stringify(body):undefined});return {status:response.status,data:await response.json(),observed:deps.observed};}
 finally {await new Promise(resolve=>server.close(resolve));}
}
test('anonymous HTTP rejected before DB access',async()=>{const r=await serverTest('/hosts/'+A+'/reservations',null);assert.equal(r.status,401);assert.ok(!r.observed.some(x=>x.sql.startsWith('SELECT current_user')))});
test('HTTP user A sees only host A data in mock restricted DB',async()=>{const a=await serverTest('/hosts/'+A+'/reservations','fixture-user-a');const b=await serverTest('/hosts/'+B+'/reservations','fixture-user-a');assert.equal(a.status,200);assert.equal(a.data.reservations.length,1);assert.equal(b.data.reservations.length,0)});
test('HTTP user B cannot create reservation for A in mock restricted DB',async()=>{const r=await serverTest('/hosts/'+A+'/reservations','fixture-user-b','POST',payload);assert.equal(r.status,403)});
test('HTTP user A can create synthetically in mock repository',async()=>{const r=await serverTest('/hosts/'+A+'/reservations','fixture-user-a','POST',payload);assert.equal(r.status,201)});
test('reject malformed reservation without DB access',async()=>{const r=await serverTest('/hosts/'+A+'/reservations','fixture-user-a','POST',{...payload,checkOut:'2026-10-19'});assert.equal(r.status,400)});
