import {createRequire} from 'node:module';
import {auth} from '../../../auth.config.mjs';
import pg from 'pg';
const require=createRequire(import.meta.url);
const {handleReservationApi}=require('../../../bff/beta-reservations.cjs');
const pool=new pg.Pool({connectionString:process.env.DATABASE_URL,max:3,ssl:{rejectUnauthorized:true}});
export default async function handler(req,res){
 const hostId=req.query?.hostId;
 const outcome=await handleReservationApi({auth,pool,headers:new Headers(req.headers),method:req.method,hostId,body:req.body});
 res.status(outcome.status).json(outcome.body);
}
