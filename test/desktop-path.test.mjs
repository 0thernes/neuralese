import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const { safeAppPath, safeRange } = createRequire(import.meta.url)('../desktop/safe-path.cjs');
const root = '/app/www';
test('desktop path stays inside the app root', () => {
  assert.equal(safeAppPath(root, '/index.html'), '/app/www/index.html');
  assert.equal(safeAppPath(root, '/'), '/app/www/index.html');
  assert.equal(safeAppPath(root, '/%E0'), null);
  assert.equal(safeAppPath(root, '/../../etc/passwd'), null);
  assert.equal(safeAppPath(root, '/%2e%2e%2fwww-evil/x'), null);
  assert.equal(safeAppPath(root, '/www-evil/x'), '/app/www/www-evil/x');
});
test('byte ranges that run past the file are rejected', () => {
  assert.equal(safeRange(10, undefined), null);
  assert.deepEqual(safeRange(10, 'bytes=0-4'), { start: 0, end: 4, size: 10 });
  assert.deepEqual(safeRange(10, 'bytes=2-'), { start: 2, end: 9, size: 10 });
  assert.equal(safeRange(10, 'bytes=20-30').invalid, true);
  assert.equal(safeRange(10, 'bytes=5-2').invalid, true);
});
