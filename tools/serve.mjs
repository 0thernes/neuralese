// Minimal static server for the web root (src/) used by the headless smoke tests and local dev. Usage: node tools/serve.mjs [port=8765] [dir=src]
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const port = +(process.argv[2] || 8765), root = path.resolve(process.argv[3] || 'src');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.wasm': 'application/wasm', '.woff2': 'font/woff2', '.md': 'text/markdown', '.txt': 'text/plain' };
http.createServer((req, res) => { let p = decodeURIComponent(new URL(req.url, 'http://x').pathname); if (p.endsWith('/')) p += 'index.html';
  const f = path.join(root, path.normalize(p)); if (!f.startsWith(root)) { res.writeHead(403); return res.end(); }
  fs.stat(f, (e, st) => { if (e || !st.isFile()) { res.writeHead(404); return res.end('not found'); }
    const range = req.headers.range && /bytes=(\d+)-(\d*)/.exec(req.headers.range), type = MIME[path.extname(f)] || 'application/octet-stream';
    if (range) { const a = +range[1], b = range[2] ? +range[2] : st.size - 1; res.writeHead(206, { 'Content-Type': type, 'Content-Range': `bytes ${a}-${b}/${st.size}`, 'Content-Length': b - a + 1, 'Accept-Ranges': 'bytes' }); return fs.createReadStream(f, { start: a, end: b }).pipe(res); }
    res.writeHead(200, { 'Content-Type': type, 'Content-Length': st.size, 'Accept-Ranges': 'bytes' }); fs.createReadStream(f).pipe(res); }); })
  .listen(port, () => console.log(`serving ${root} on http://localhost:${port}/`));
