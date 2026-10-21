import {createRequire} from 'node:module';
import {auth} from '../../../../auth.config.mjs';
import pg from 'pg';
const require=createRequire(import.meta.url);
const {assertDbTarget}=require('../../../../bff/deployment-readiness.cjs');
const {handleReservationApi}=require('../../../../bff/beta-reservations.cjs');
let pool;
function guardedPool(){
  assertDbTarget(process.env);
  if (!pool) pool=new pg.Pool({connectionString:process.env.DATABASE_URL,max:3,ssl:{rejectUnauthorized:true}});
  return pool;
}
export default async function handler(req,res){
 if(process.env.STAYBLOCK_BETA_API_ENABLED!=='true') return res.status(503).json({error:'BETA_API_DISABLED'});
 let db; try { db=guardedPool(); } catch { return res.status(503).json({error:'BETA_NOT_CONFIGURED'}); }
 const outcome=await handleReservationApi({auth,pool:db,headers:new Headers(req.headers),method:req.method,hostId:req.query?.hostId,reservationId:req.query?.reservationId,body:req.body});
 res.status(outcome.status).json(outcome.body);
}
