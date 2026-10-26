// v12: runs the fine-tune off the main thread (the exact-gradient loop costs ~10 s per Adam step on CPU).
import { fineTune } from './finetune.js?v=12';
self.onmessage = async (e) => { const { W, ids, opts } = e.data; try { const r = await fineTune(W, ids, { ...opts, onStep: (s) => self.postMessage({ evt: true, ...s }) }); self.postMessage({ ok: true, result: r }); } catch (err) { self.postMessage({ ok: false, error: String(err?.message || err) }); } };
