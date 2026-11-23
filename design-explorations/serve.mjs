import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const root = path.resolve('frontend/dist');
const types = { '.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.json':'application/json','.png':'image/png','.woff2':'font/woff2','.ico':'image/x-icon' };
http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://x');
  if (u.pathname.startsWith('/api/')) {
    try {
      const r = await fetch('https://aexterminal.com' + u.pathname + u.search, { method: req.method });
      res.writeHead(r.status, { 'content-type': r.headers.get('content-type') || 'application/json' });
      res.end(Buffer.from(await r.arrayBuffer()));
    } catch { res.writeHead(502); res.end('proxy error'); }
    return;
  }
  let f = path.join(root, decodeURIComponent(u.pathname));
  if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(root, 'index.html');
  res.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
}).listen(4175, () => console.log('up'));
