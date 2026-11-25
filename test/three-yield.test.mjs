import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { patchThreeYield } from '../ui/three-yield.mjs';

const root = path.resolve(import.meta.dirname, '..');

test('three yields on a frame instead of a native resolver timer', () => {
  const utils = fs.readFileSync(path.join(root, 'ui/node_modules/three/src/utils.js'), 'utf8');
  const patchedUtils = patchThreeYield(utils, 'node_modules/three/src/utils.js');
  assert.ok(patchedUtils);
  assert.equal(patchedUtils.includes('return self.scheduler.yield'), false);
  assert.match(patchedUtils, /MessageChannel/);
  assert.match(patchedUtils, /__timerResume/);

  const renderer = fs.readFileSync(path.join(root, 'ui/node_modules/three/src/renderers/common/Renderer.js'), 'utf8');
  const patched = patchThreeYield(renderer, 'node_modules/three/src/renderers/common/Renderer.js');
  assert.ok(patched);
  assert.equal(patched.includes('setTimeout( done, 0 )'), false);
  assert.equal(patched.includes('setTimeout( done, 100 )'), false);
  assert.match(patched, /compile-yield/);
  assert.match(patched, /this\.lastYieldTime = performance\.now\(\)/);

  const core = fs.readFileSync(path.join(root, 'ui/node_modules/three/build/three.core.js'), 'utf8');
  const patchedCore = patchThreeYield(core, 'node_modules/three/build/three.core.js');
  assert.ok(patchedCore);
  assert.equal(patchedCore.includes('return self.scheduler.yield'), false);

  const webgpu = fs.readFileSync(path.join(root, 'ui/node_modules/three/build/three.webgpu.js'), 'utf8');
  const patchedGpu = patchThreeYield(webgpu, 'node_modules/three/build/three.webgpu.js');
  assert.ok(patchedGpu);
  assert.equal(patchedGpu.includes('setTimeout( done, 0 )'), false);
  assert.equal(patchedGpu.includes('setTimeout( done, 100 )'), false);
});
