'use strict';

const http = require('node:http');
const { createApp, LOCAL_ORIGIN } = require('./app.cjs');
// No env-file loader, DB client, provider SDK, outgoing fetch, static file server or mock login.
function createLocalServer() {
  const dispatch = createApp();
  return http.createServer(async (req, res) => {
    const send = (status, body, headers = {}) => {
      res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store', ...headers });
      res.end(JSON.stringify(body));
    };
    if (req.headers.host !== new URL(LOCAL_ORIGIN).host) return send(403, { code: 'HOST_FORBIDDEN' });
    const chunks = []; let size = 0;
    try {
      for await (const chunk of req) {
        size += chunk.length;
        if (size > 16_384) { send(413, { code: 'BODY_TOO_LARGE' }); return; }
        chunks.push(chunk);
      }
      let body;
      const raw = Buffer.concat(chunks).toString('utf8');
      try { body = raw ? JSON.parse(raw) : undefined; }
      catch { return send(400, { code: 'INVALID_JSON' }); }
      const result = await dispatch({ path: req.url, method: req.method, headers: req.headers, body });
      send(result.status, result.body, result.headers);
    } catch { if (!res.headersSent) send(400, { code: 'INVALID_REQUEST' }); }
  });
}
if (require.main === module) {
  const server = createLocalServer();
  server.requestTimeout = 10_000;
  server.headersTimeout = 5_000;
  server.on('error', () => { console.error('Local scaffold could not start.'); process.exitCode = 1; });
  server.listen(8787, '127.0.0.1', () => console.log(`${LOCAL_ORIGIN} — NOT_CONFIGURED; offline scaffold only`));
}
module.exports = { createLocalServer };
