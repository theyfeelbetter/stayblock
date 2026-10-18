// Vercel catch-all Better Auth route. Do not deploy until account schema and secrets verified.
import { auth } from '../../auth.config.mjs';
export default async function handler(req,res) {
  if(process.env.STAYBLOCK_BETA_AUTH_ENABLED!=='true') return res.status(503).json({error:'BETA_AUTH_DISABLED'});
  // Deny unaudited signup at app perimeter too.
  if (req.url?.includes('/sign-up')) { res.status(403).json({error:'INVITE_ONLY'}); return; }
  const proto = req.headers['x-forwarded-proto'] === 'https' ? 'https' : null;
  if (!proto) { res.status(400).json({error:'HTTPS_REQUIRED'}); return; }
  const url = new URL(req.url, process.env.BETTER_AUTH_URL);
  const request = new Request(url, {method:req.method, headers:req.headers, body:['GET','HEAD'].includes(req.method)?undefined:JSON.stringify(req.body??{}), duplex:'half'});
  const response = await auth.handler(request);
  res.status(response.status);
  for (const [key,value] of response.headers) if(key.toLowerCase()!=='content-length')res.setHeader(key,value);
  res.send(Buffer.from(await response.arrayBuffer()));
}
