// Resolve a request path under the app root. Bad escapes and odd encodings are rejected.
const path = require('node:path');
function safeAppPath(root, pathname) {
  let p;
  try { p = decodeURIComponent(pathname); } catch { return null; }
  if (p.includes('\0')) return null;
  if (p.endsWith('/')) p += 'index.html';
  const f = path.resolve(root, '.' + (p.startsWith('/') ? p : '/' + p));
  const rel = path.relative(root, f);
  if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) return null;
  return f;
}
function safeRange(size, header) {
  const m = typeof header === 'string' && /bytes=(\d+)-(\d*)/.exec(header);
  if (!m) return null;
  const start = Number(m[1]);
  const end = m[2] === '' ? size - 1 : Number(m[2]);
  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end < start || start >= size) return { invalid: true, size };
  return { start, end: Math.min(end, size - 1), size };
}
module.exports = { safeAppPath, safeRange };
