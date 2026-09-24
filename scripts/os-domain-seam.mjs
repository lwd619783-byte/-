/** Fixed-route loopback relay for explicit publication to configured private staging.
 * No local DB/SQL/file access. Destination is server configuration, never request input.
 */
export function domainRelayAllowed(req) {
  const host = req.headers.host;
  return typeof host === 'string' && /^(localhost|127\.0\.0\.1):\d+$/.test(host)
    && ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress)
    && (!req.headers.origin || req.headers.origin === `http://${host}`)
    && (!req.headers['sec-fetch-site'] || req.headers['sec-fetch-site'] === 'same-origin')
    && typeof req.headers['x-bridge-owner-secret'] === 'string';
}
export function osDomainSeam() {
  return { name: 'os-domain-explicit-publish', apply: 'serve', configureServer(server) {
    server.middlewares.use('/api/os-domain', async (req, res) => {
      res.setHeader('Cache-Control', 'no-store'); res.setHeader('Content-Type', 'application/json');
      const fail = status => { res.statusCode = status; res.end(JSON.stringify({ error: 'DOMAIN_RELAY_UNAVAILABLE' })); };
      if (!domainRelayAllowed(req)) return fail(403);
      const origin = process.env.OS_DOMAIN_REMOTE_ORIGIN;
      if (!origin || !/^https:\/\/[^/?#@]+$/.test(origin)) return fail(503);
      const action = req.url;
      if (!((action === '/status' && req.method === 'GET') || (['/publish', '/revoke'].includes(action) && req.method === 'POST'))) return fail(404);
      try {
        let bytes = 0; const chunks = [];
        for await (const chunk of req) { bytes += chunk.length; if (bytes > 1100 * 1024) return fail(413); chunks.push(chunk); }
        const response = await fetch(`${origin}/api/os-domain${action}`, { method: req.method, redirect: 'error', signal: AbortSignal.timeout(20000),
          headers: { Origin: origin, 'Content-Type': 'application/json', 'X-Bridge-Owner-Secret': req.headers['x-bridge-owner-secret'] },
          ...(req.method === 'POST' ? { body: Buffer.concat(chunks) } : {}) });
        if (!response.ok) return fail(response.status === 401 ? 401 : 503);
        // Only a bounded status/receipt response; never relay headers, redirects or errors.
        const text = await response.text(); if (text.length > 4096) return fail(503);
        const value = JSON.parse(text); res.end(JSON.stringify(value));
      } catch { fail(503); }
    });
  } };
}
