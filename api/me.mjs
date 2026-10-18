import {createRequire} from 'node:module';
import {auth} from '../auth.config.mjs';
import pg from 'pg';
const require=createRequire(import.meta.url);
const {assertDbTarget}=require('../bff/deployment-readiness.cjs');
const {handleHostContext}=require('../bff/host-context.cjs');
let pool;
export default async function handler(req,res){
 if(process.env.STAYBLOCK_BETA_API_ENABLED!=='true')return res.status(503).json({error:'BETA_API_DISABLED'});
 if(req.method!=='GET')return res.status(405).json({error:'METHOD_NOT_ALLOWED'});
 let db;
 try {
  assertDbTarget(process.env);
  if(!pool)pool=new pg.Pool({connectionString:process.env.DATABASE_URL,max:3,ssl:{rejectUnauthorized:true}});
  db=pool;
 }catch{return res.status(503).json({error:'BETA_NOT_CONFIGURED'});}
 const result=await handleHostContext({auth,pool:db,headers:new Headers(req.headers)});
 res.status(result.status).json(result.body);
}
