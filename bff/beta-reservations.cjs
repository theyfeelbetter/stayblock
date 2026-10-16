'use strict';
const {withVerifiedDbSession}=require('./verified-db-session.cjs');
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DAY=/^\d{4}-\d{2}-\d{2}$/;
function validDay(v){return typeof v==='string'&&DAY.test(v)&&!Number.isNaN(Date.parse(v+'T00:00:00Z'))&&new Date(v+'T00:00:00Z').toISOString().slice(0,10)===v}
function fail(status,error){return {status,body:{error}}}
function respondError(err){
 if(err?.code==='23P01')return fail(409,'RESERVATION_CONFLICT');
 if(err?.code==='23503'||err?.code==='42501')return fail(403,'FORBIDDEN');
 if(err?.message==='UNAUTHENTICATED')return fail(401,'UNAUTHENTICATED');
 return fail(500,'INTERNAL_ERROR');
}
async function handleReservationApi({auth,pool,headers,method,hostId,reservationId,body}) {
 if(!UUID.test(hostId||''))return fail(400,'INVALID_HOST_ID');
 if(reservationId&&!UUID.test(reservationId))return fail(400,'INVALID_RESERVATION_ID');
 if(!['GET','POST','PATCH','DELETE'].includes(method))return fail(405,'METHOD_NOT_ALLOWED');
 if((method==='POST'&&reservationId)||(method==='GET'&&!hostId))return fail(405,'METHOD_NOT_ALLOWED');
 if(['POST','PATCH'].includes(method)){
  if(!body||!UUID.test(body.roomId||'')||!validDay(body.checkIn)||!validDay(body.checkOut)||body.checkOut<=body.checkIn||!['confirmed','pending','cancelled'].includes(body.status))return fail(400,'INVALID_RESERVATION');
  if(method==='PATCH'&&(!Number.isSafeInteger(body.version)||body.version<1))return fail(400,'INVALID_VERSION');
 }
 try{
 return await withVerifiedDbSession({auth,pool,headers,work:async(client)=>{
  const h=[hostId];
  if(method==='GET'){
   const q=reservationId?
    await client.query('SELECT id,room_id,check_in,check_out,status,version FROM stayblock.reservations WHERE host_id=$1 AND id=$2',[hostId,reservationId]):
    await client.query('SELECT id,room_id,check_in,check_out,status,version FROM stayblock.reservations WHERE host_id=$1 ORDER BY check_in LIMIT 200',h);
   return {status:200,body:{reservations:q.rows}};
  }
  // Rows invisible to RLS are indistinguishable from nonexistent rows.
  if(method==='DELETE'){
   const q=await client.query('DELETE FROM stayblock.reservations WHERE host_id=$1 AND id=$2 RETURNING id',[hostId,reservationId]);
   return q.rowCount?{status:200,body:{deleted:true}}:fail(404,'NOT_FOUND');
  }
  if(method==='POST'){
   const q=await client.query('INSERT INTO stayblock.reservations(host_id,room_id,check_in,check_out,status) VALUES($1,$2,$3,$4,$5) RETURNING id,room_id,check_in,check_out,status,version',[hostId,body.roomId,body.checkIn,body.checkOut,body.status]);
   return {status:201,body:{reservation:q.rows[0]}};
  }
  if(!reservationId)return fail(400,'MISSING_RESERVATION_ID');
  const q=await client.query('UPDATE stayblock.reservations SET room_id=$3,check_in=$4,check_out=$5,status=$6,version=version+1 WHERE host_id=$1 AND id=$2 AND version=$7 RETURNING id,room_id,check_in,check_out,status,version',[hostId,reservationId,body.roomId,body.checkIn,body.checkOut,body.status,body.version]);
  return q.rowCount?{status:200,body:{reservation:q.rows[0]}}:fail(409,'NOT_FOUND_OR_STALE');
 }});
 }catch(error){return respondError(error)}
}
module.exports={handleReservationApi,validDay};
