import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
export function portfolioRequestAllowed(req) {
  const host = req.headers.host;
  return typeof host === 'string' && /^(localhost|127\.0\.0\.1):\d+$/.test(host)
    && ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress)
    && req.method === 'GET' && req.headers['x-portfolio-read'] === '1'
    && (!req.headers.origin || req.headers.origin === `http://${host}`)
    && (!req.headers['sec-fetch-site'] || req.headers['sec-fetch-site'] === 'same-origin');
}
/** Development loopback only. No CORS, write routes, arbitrary path or SQL input. */
export function portfolioSeam() {
  return { name: 'portfolio-local-read', apply: 'serve', configureServer(server) {
    server.middlewares.use('/__local/portfolio', (req, res) => {
      res.setHeader('Cache-Control', 'no-store'); res.setHeader('Content-Type', 'application/json'); res.setHeader('X-Content-Type-Options', 'nosniff');
      const reply = (status, code) => { res.statusCode = status; res.end(JSON.stringify({ error: code })); };
      if (!portfolioRequestAllowed(req)) return reply(403, 'PORTFOLIO_READ_DENIED');
      const file = process.env.PORTFOLIO_LOCAL_DB;
      if (!file) return reply(503, 'PORTFOLIO_NOT_CONNECTED');
      const url = new URL(req.url, 'http://localhost'), asOf = url.searchParams.get('asOf');
      if (url.pathname !== '/' || [...url.searchParams.keys()].some(k => k !== 'asOf') || url.searchParams.getAll('asOf').length !== 1 || !asOf || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(asOf) || !Number.isFinite(Date.parse(asOf)) || Date.parse(asOf) > Date.now()) return reply(400, 'PORTFOLIO_ASOF_INVALID');
      execFile(process.execPath, ['.local-core-build/portfolio-cli.js', file, asOf], { cwd: root, windowsHide: true, timeout: 10000, maxBuffer: 4 * 1024 * 1024 }, (error, stdout) => {
        if (error) return reply(503, 'PORTFOLIO_LOCAL_READ_BLOCKED');
        res.end(stdout);
      });
    });
  } };
}
