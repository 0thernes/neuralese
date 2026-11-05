// Minimal static server for the web root (src/) used by the headless smoke tests and local dev. Usage: node tools/serve.mjs [port=8765] [dir=src]
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
import { createRequire } from 'node:module';
const { safeAppPath, safeRange } = createRequire(import.meta.url)('../desktop/safe-path.cjs');
const port = +(process.argv[2] || 8765), root = path.resolve(process.argv[3] || 'src');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.wasm': 'application/wasm', '.woff2': 'font/woff2', '.md': 'text/markdown', '.txt': 'text/plain' };
http.createServer((req, res) => {
  let u; try { u = new URL(req.url, 'http://x'); } catch { res.writeHead(400); return res.end(); }
  const f = safeAppPath(root, u.pathname); if (!f) { res.writeHead(403); return res.end(); }
  fs.stat(f, (e, st) => { if (e || !st.isFile()) { res.writeHead(404); return res.end('not found'); }
    const type = MIME[path.extname(f)] || 'application/octet-stream';
    const range = safeRange(st.size, req.headers.range);
    if (range?.invalid) { res.writeHead(416, { 'Content-Range': `bytes */${st.size}`, 'Accept-Ranges': 'bytes' }); return res.end(); }
    if (range) { res.writeHead(206, { 'Content-Type': type, 'Content-Range': `bytes ${range.start}-${range.end}/${st.size}`, 'Content-Length': range.end - range.start + 1, 'Accept-Ranges': 'bytes' }); return fs.createReadStream(f, { start: range.start, end: range.end }).pipe(res); }
    res.writeHead(200, { 'Content-Type': type, 'Content-Length': st.size, 'Accept-Ranges': 'bytes' }); fs.createReadStream(f).pipe(res); }); })
  .listen(port, () => console.log(`serving ${root} on http://localhost:${port}/`));
