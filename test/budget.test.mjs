import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runBudgeted, yieldHost, cancelJobs, resetCancel } from '../src/coop.js';

function clock() {
  let now = 0;
  const orig = performance.now.bind(performance);
  performance.now = () => now;
  return {
    set(v) { now = v; },
    add(v) { now += v; },
    get() { return now; },
    restore() { performance.now = orig; },
  };
}

test('runBudgeted yields only after the time budget is spent and keeps step order', async () => {
  const t = clock();
  const seen = [];
  const yields = [];
  const prev = globalThis.scheduler;
  globalThis.scheduler = { yield() { yields.push(t.get()); return Promise.resolve(); } };
  try {
    await runBudgeted((function* () {
      for (let i = 0; i < 5; i++) { seen.push(i); t.add(3); yield; }
    })(), { budgetMs: 8 });
  } finally {
    t.restore();
    globalThis.scheduler = prev;
    resetCancel();
  }
  assert.deepEqual(seen, [0, 1, 2, 3, 4]);
  // 0+3, +3, +3 crosses 8 at t=9. The clock then restarts, and the last two steps stay inside the next budget.
  assert.deepEqual(yields, [9]);
});

test('runBudgeted does not yield while the work stays inside the budget', async () => {
  const t = clock();
  const yields = [];
  const prev = globalThis.scheduler;
  globalThis.scheduler = { yield() { yields.push(t.get()); return Promise.resolve(); } };
  try {
    await runBudgeted((function* () {
      for (let i = 0; i < 4; i++) { t.add(1); yield; }
    })(), { budgetMs: 8 });
  } finally {
    t.restore();
    globalThis.scheduler = prev;
  }
  assert.deepEqual(yields, []);
});

test('yieldHost prefers scheduler.yield, then MessageChannel, then requestAnimationFrame', async () => {
  const prevSched = globalThis.scheduler;
  const PrevMC = globalThis.MessageChannel;
  const prevRaf = globalThis.requestAnimationFrame;
  try {
    let used = '';
    globalThis.scheduler = { yield() { used = 'sched'; return Promise.resolve(); } };
    globalThis.MessageChannel = function () { used = 'mc'; throw new Error('channel'); };
    await yieldHost();
    assert.equal(used, 'sched');

    used = '';
    globalThis.scheduler = undefined;
    let constructed = 0;
    globalThis.MessageChannel = class extends PrevMC {
      constructor() { super(); constructed++; }
    };
    await yieldHost();
    assert.equal(constructed, 1);

    used = '';
    globalThis.scheduler = undefined;
    globalThis.MessageChannel = undefined;
    let raf = 0;
    globalThis.requestAnimationFrame = (cb) => { raf++; cb(0); return 1; };
    await yieldHost();
    assert.equal(raf, 1);
  } finally {
    globalThis.scheduler = prevSched;
    globalThis.MessageChannel = PrevMC;
    globalThis.requestAnimationFrame = prevRaf;
  }
});

test('runBudgeted throws once the job is cancelled', async () => {
  const t = clock();
  const prev = globalThis.scheduler;
  globalThis.scheduler = { yield() { return Promise.resolve(); } };
  try {
    await assert.rejects(runBudgeted((function* () {
      t.add(5); yield;
      cancelJobs();
      t.add(5); yield;
    })(), { budgetMs: 1 }), /cancelled/);
  } finally {
    t.restore();
    globalThis.scheduler = prev;
    resetCancel();
  }
});
