'use strict';
// Fail closed before opening sockets. No secrets logged or returned.
function assertDbTarget(env=process.env){
  const check=(raw,role,key)=>{
    if(!raw)throw Error(key+'_MISSING');
    let u;try{u=new URL(raw)}catch{throw Error(key+'_INVALID')}
    if(!['postgres:','postgresql:'].includes(u.protocol)||
      u.username!==role||
      !u.hostname.endsWith('.neon.tech')||
      !['require','verify-full'].includes(u.searchParams.get('sslmode')))throw Error(key+'_ROLE_OR_TLS_UNSAFE');
    return {role,host:u.hostname,database:u.pathname.slice(1)};
  };
  const booking=check(env.DATABASE_URL,'stayblock_http','DATABASE_URL');
  const auth=check(env.AUTH_DATABASE_URL,'stayblock_auth_login','AUTH_DATABASE_URL');
  if(!env.BETTER_AUTH_URL?.startsWith('https://'))throw Error('BETTER_AUTH_HTTPS_REQUIRED');
  if(!env.BETTER_AUTH_SECRET||env.BETTER_AUTH_SECRET.length<32)throw Error('BETTER_AUTH_SECRET_MISSING');
  if(booking.host!==auth.host||booking.database!==auth.database)throw Error('DATABASE_BRANCH_MISMATCH');
  return {database:booking.database,host:booking.host,ready:true};
}
module.exports={assertDbTarget};
