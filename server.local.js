// Pure Node.js local dev server — no Express, no Socket.IO
// Mimics Vercel's routing (/api/*.js as functions, /public as static) so
// `npm run dev` behaves the same as `vercel dev`.

const http = require('http');
const fs = require('fs');
const path = require('path');

// Minimal .env loader — no `dotenv` dependency, keeps the project zero-dep.
// Vercel injects env vars itself in production, this is only for local dev.
(function loadDotEnv() {
  const envPath = path.join(__dirname, '.env');
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, 'utf8').split('\n');
  lines.forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const idx = trimmed.indexOf('=');
    if (idx === -1) return;
    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
    if (!(key in process.env)) process.env[key] = value;
  });
})();

const PORT = process.env.PORT || 4382;
const PUBLIC_DIR = path.join(__dirname, 'public');
const API_DIR = path.join(__dirname, 'api');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.png': 'image/png',
};

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  let pathname = decodeURIComponent(url.pathname);

  // API routes: /api/members -> api/members.js, /api/register -> api/register.js
  if (pathname.startsWith('/api/')) {
    const name = pathname.replace('/api/', '').replace(/\/$/, '');
    const filePath = path.join(API_DIR, name + '.js');
    if (fs.existsSync(filePath)) {
      delete require.cache[require.resolve(filePath)];
      const handler = require(filePath);
      try {
        await handler(req, res);
      } catch (err) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ ok: false, error: 'Internal error' }));
      }
      return;
    }
    res.statusCode = 404;
    res.end('Not found');
    return;
  }

  // Static files
  if (pathname === '/') pathname = '/landing.html';
  const filePath = path.join(PUBLIC_DIR, pathname);

  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.statusCode = 403;
    res.end('Forbidden');
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.statusCode = 404;
      res.end('Not found');
      return;
    }
    const ext = path.extname(filePath);
    res.setHeader('Content-Type', MIME[ext] || 'application/octet-stream');
    res.statusCode = 200;
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log('Flash Peak Community (pure Node.js) running -> http://localhost:' + PORT);
});
