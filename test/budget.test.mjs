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

function installFrame(t) {
  const prevRaf = globalThis.requestAnimationFrame;
  const PrevMC = globalThis.MessageChannel;
  const prevSched = globalThis.scheduler;
  let raf = 0;
  let posts = 0;
  let yields = 0;
  globalThis.scheduler = { yield() { yields++; return Promise.resolve(); } };
  globalThis.requestAnimationFrame = (cb) => { raf++; queueMicrotask(() => cb(t.get())); return raf; };
  globalThis.MessageChannel = class extends PrevMC {
    constructor() { super(); posts++; }
  };
  return {
    raf: () => raf,
    posts: () => posts,
    yields: () => yields,
    restore() {
      globalThis.requestAnimationFrame = prevRaf;
      globalThis.MessageChannel = PrevMC;
      globalThis.scheduler = prevSched;
    },
  };
}

test('runBudgeted waits for a frame only after the shared budget is spent', async () => {
  const t = clock();
  const frame = installFrame(t);
  const seen = [];
  try {
    await runBudgeted((function* () {
      for (let i = 0; i < 5; i++) { seen.push(i); t.add(3); yield; }
    })(), { budgetMs: 8, label: 'order' });
  } finally {
    t.restore();
    frame.restore();
    resetCancel();
  }
  assert.deepEqual(seen, [0, 1, 2, 3, 4]);
  assert.equal(frame.yields(), 0);
  assert.ok(frame.raf() >= 1);
  assert.equal(frame.posts(), frame.raf());
});

test('work inside the frame budget does not wait for a paint', async () => {
  const t = clock();
  const frame = installFrame(t);
  try {
    await runBudgeted((function* () {
      for (let i = 0; i < 4; i++) { t.add(1); yield; }
    })(), { label: 'short' });
  } finally {
    t.restore();
    frame.restore();
    resetCancel();
  }
  assert.equal(frame.raf(), 0);
});

test('concurrent jobs share one frame budget', async () => {
  const t = clock();
  const frame = installFrame(t);
  const marks = [];
  try {
    const job = (name) => runBudgeted((function* () {
      for (let i = 0; i < 4; i++) { marks.push({ name, t: t.get(), frame: frame.raf() }); t.add(5); yield; }
    })(), { label: name });
    await Promise.all([job('a'), job('b')]);
  } finally {
    t.restore();
    frame.restore();
    resetCancel();
  }
  assert.equal(marks.length, 8);
  const byFrame = new Map();
  for (const m of marks) {
    const span = byFrame.get(m.frame) ?? { lo: m.t, hi: m.t };
    span.lo = Math.min(span.lo, m.t);
    span.hi = Math.max(span.hi, m.t);
    byFrame.set(m.frame, span);
  }
  for (const span of byFrame.values()) assert.ok(span.hi - span.lo <= 13, JSON.stringify([...byFrame]));
  assert.ok(frame.raf() >= 3, 'frames ' + frame.raf());
  assert.equal(frame.yields(), 0);
});

test('a frame wait is requestAnimationFrame then a MessageChannel post', async () => {
  const t = clock();
  const frame = installFrame(t);
  try {
    await yieldHost('paint');
  } finally {
    t.restore();
    frame.restore();
  }
  assert.equal(frame.yields(), 0);
  assert.equal(frame.raf(), 1);
  assert.equal(frame.posts(), 1);
});

test('runBudgeted throws once the job is cancelled', async () => {
  const t = clock();
  const frame = installFrame(t);
  try {
    await assert.rejects(runBudgeted((function* () {
      t.add(5); yield;
      cancelJobs();
      t.add(5); yield;
    })(), { budgetMs: 1, label: 'cancel' }), /cancelled/);
  } finally {
    t.restore();
    frame.restore();
    resetCancel();
  }
});

test('a step over 16 ms is logged with its name', async () => {
  const t = clock();
  const frame = installFrame(t);
  const warnings = [];
  const orig = console.warn;
  console.warn = (...args) => { warnings.push(args.join(' ')); };
  try {
    await runBudgeted((function* () {
      t.add(20); yield;
    })(), { label: 'batch-reset' });
  } finally {
    console.warn = orig;
    t.restore();
    frame.restore();
    resetCancel();
  }
  assert.ok(warnings.some((w) => w.includes('batch-reset') && w.includes('20.0')));
});
