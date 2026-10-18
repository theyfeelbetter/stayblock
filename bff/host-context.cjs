'use strict';
const {withVerifiedDbSession}=require('./verified-db-session.cjs');
async function handleHostContext({auth,pool,headers}){
 try{
  return await withVerifiedDbSession({auth,pool,headers,work:async(client)=>{
   const hosts=await client.query(`SELECT h.id,h.name,m.role FROM stayblock.memberships m
     JOIN stayblock.hosts h ON h.id=m.host_id WHERE m.active=true
     ORDER BY h.name LIMIT 20`);
   const properties=await client.query(`SELECT p.id,p.host_id,p.name FROM stayblock.properties p ORDER BY p.name LIMIT 200`);
   const rooms=await client.query(`SELECT r.id,r.host_id,r.property_id,r.name FROM stayblock.rooms r ORDER BY r.name LIMIT 500`);
   return {status:200,body:{hosts:hosts.rows,properties:properties.rows,rooms:rooms.rows}};
  }});
 }catch(e){return {status:e?.message==='UNAUTHENTICATED'?401:503,body:{error:e?.message==='UNAUTHENTICATED'?'UNAUTHENTICATED':'CONTEXT_UNAVAILABLE'}}}
}
module.exports={handleHostContext};
