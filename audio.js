// NEURALESE audio: calm, data-driven lab-instrument sonification (Web Audio). Everything is synthesized; no samples.
// Pure mapping functions at the top are unit-tested (test/audio.test.mjs) and have no Web Audio dependency.

// ───────── pure data → sound mappings ─────────
// Consonant scales only. "lydian" here omits the #4 so no tritone over the root can ever sound.
export const MODES = { pentatonic: [0, 2, 4, 7, 9], ionian: [0, 2, 4, 5, 7, 9, 11], lydian: [0, 2, 4, 7, 9, 11] };
const MODE_ORDER = ['pentatonic', 'ionian', 'lydian'];
export const midiToHz = (m) => 440 * 2 ** ((m - 69) / 12);
export function hiddenStats(x) {
  const n = x.length; let mu = 0; for (const v of x) mu += v; mu /= n; let m2 = 0, m3 = 0, m4 = 0, amax = 0, imax = 0;
  for (let i = 0; i < n; i++) { const c = x[i] - mu; m2 += c * c; m3 += c * c * c; m4 += c * c * c * c; if (Math.abs(x[i]) > amax) { amax = Math.abs(x[i]); imax = i; } }
  m2 /= n; m3 /= n; m4 /= n; const sd = Math.sqrt(m2) || 1e-9; return { mean: mu, sd, skew: m3 / sd ** 3, kurt: m4 / (m2 * m2 || 1e-18) - 3, imax };
}
// Hidden-state stats → {mode, root}: tail-heaviness (kurtosis) picks the scale colour; the dominant dimension picks the key (C3..B3).
export function modeFromHidden(x) {
  const s = hiddenStats(x); const k = Math.max(0, Math.min(MODE_ORDER.length - 1, Math.floor(Math.log2(1 + Math.max(0, s.kurt)) / 2)));
  return { mode: MODE_ORDER[k], root: 48 + (s.imax % 12), stats: s };
}
export function degreeToMidi(deg, root, mode) { const sc = MODES[mode] || MODES.pentatonic, n = sc.length, o = Math.floor(deg / n), i = ((deg % n) + n) % n; return root + 12 * o + sc[i]; }
// Token pitch: confident tokens high, improbable ones lower; always a scale tone, within ~2 octaves above the root.
export function tokenPitch(p, rank, root, mode) { const n = (MODES[mode] || MODES.pentatonic).length, deg = Math.round(2 * n + Math.log10(Math.max(p, 1e-9)) * 1.6 - Math.log10(1 + rank)); return degreeToMidi(Math.max(0, Math.min(2 * n, deg)), root + 12, mode); }
// Residual norms → timbre: brightness (norm growth) sets filter/FM index; spread sets a gentle second partial. Both in [0,1].
export function timbreFromNorms(norms) {
  if (!norms || norms.length < 2) return { bright: 0.5, rough: 0 }; const a = norms[0] || 1e-9, b = norms[norms.length - 1];
  const mu = norms.reduce((s, v) => s + v, 0) / norms.length, vr = norms.reduce((s, v) => s + (v - mu) ** 2, 0) / norms.length;
  return { bright: Math.max(0, Math.min(1, Math.log2(b / a + 1e-9) / 5)), rough: Math.max(0, Math.min(1, Math.sqrt(vr) / (mu || 1))) };
}
// Attention → pan (centre of mass: BOS = left, self = right, averaged over heads) and mean normalized entropy.
export function attentionFocus(pats) {
  if (!pats || !pats.length) return { pan: 0, ent: 0 }; let com = 0, ent = 0;
  for (const p of pats) { const T = p.length; let c = 0, h = 0; for (let j = 0; j < T; j++) { c += p[j] * (T > 1 ? j / (T - 1) : 1); if (p[j] > 0) h -= p[j] * Math.log(p[j]); } com += c; ent += T > 1 ? h / Math.log(T) : 0; }
  return { pan: Math.max(-1, Math.min(1, (com / pats.length) * 2 - 1)), ent: ent / pats.length };
}
export const tension = (H) => 1 - Math.exp(-Math.max(0, H) / 2); // entropy (nats) → 0..1 (pad brightness)
// Surprisal accent: improbable tokens get a soft bell an octave up (0..1, gentle).
export const accent = (p, thr = 4) => Math.max(0, Math.min(1, (-Math.log(Math.max(p, 1e-12)) - thr) / 6));
export function klDiv(lpP, lpQ) { let k = 0; for (let i = 0; i < lpP.length; i++) { const p = Math.exp(lpP[i]); if (p > 1e-12) k += p * (lpP[i] - lpQ[i]); } return Math.max(0, k); }
// Divergence → consonant interval added to the pad (0 = none, then 5th, octave, octave+5th) and a filter opening 0..1.
export function divergenceVoice(kl) { const iv = kl < 0.01 ? 0 : kl < 0.3 ? 7 : kl < 1.5 ? 12 : 19; return { interval: iv, gain: iv ? Math.min(1, 0.3 + kl / 3) : 0, open: Math.min(1, Math.log1p(kl * 3) / 2) }; }
// Note-rate limiter: returns true if a note may sound at time t given last note time and min gap (s).
export const allowNote = (t, last, minGap) => t - last >= minGap;
export function detectPhenomena(h) {
  const out = [], n = h.ent.length;
  if (n >= 8) { const early = h.ent.slice(0, n - 4), late = h.ent.slice(n - 4); const me = early.reduce((a, b) => a + b, 0) / early.length; if (me > 1.2 && late.every((e) => e < 0.15)) out.push('entropy_collapse'); }
  const ids = h.ids; for (let per = 1; per <= 8; per++) { const need = per * 3; if (ids.length < need) break; let ok = true; for (let i = ids.length - need; i < ids.length - per; i++) if (ids[i] !== ids[i + per]) { ok = false; break; } if (ok) { out.push('repetition_loop'); break; } }
  const pp = h.probs[h.probs.length - 1]; if (pp && pp[0] > 0.3 && pp[1] > 0.3 && Math.abs(pp[0] - pp[1]) < 0.08) out.push('superposition');
  const nm = h.norms; if (nm.length >= 6) { const s = nm.slice(0, -1).slice().sort((a, b) => a - b), med = s[s.length >> 1]; if (nm[nm.length - 1] > 3 * med) out.push('residual_explosion'); }
  return out;
}
export function editKind(label) {
  const s = label.toLowerCase();
  if (/rome/.test(s)) return 'rome'; if (/svd|low-rank|rank-/.test(s)) return 'svd'; if (/int[248]|quant/.test(s)) return 'quant'; if (/chaos|noise/.test(s)) return 'chaos';
  if (/steer|vector|sae/.test(s)) return 'steer'; if (/swap|duplicate|delete s|slot|program|lerp|←/.test(s)) return 'swap'; if (/zero|mean|resample|ablat|skip|restore|n\d+ /.test(s)) return 'ablate'; if (/undo|reset|import/.test(s)) return 'swap'; return 'generic';
}
// Edit kind → short chime recipe: scale degrees (relative to root+24), voice, spacing (s). All consonant.
export const EDIT_CHIMES = { svd: { deg: [0, 2, 4], v: 'bell', gap: 0.06 }, ablate: { deg: [4, 0], v: 'click', gap: 0.07 }, rome: { deg: [0, 4, 7], v: 'bell', gap: 0 }, quant: { deg: [4, 2, 0], v: 'pluck', gap: 0.05 },
  chaos: { deg: [0, 3, 1, 4, 2], v: 'pluck', gap: 0.035 }, steer: { deg: [0, 1, 2, 3, 4], v: 'sine', gap: 0.05 }, swap: { deg: [2, 0, 2], v: 'pluck', gap: 0.08 }, generic: { deg: [2], v: 'bell', gap: 0 }, undo: { deg: [2, 0], v: 'sine', gap: 0.06 } };
export const STYLES = {
  lab: { name: 'Lab Instrument', pad: 0.5, voice: 'pluck', minGap: 0.11, poly: 5, choir: 1, rev: 1.2, cutoff: 1800 },
  ambient: { name: 'Soft Ambient', pad: 1, voice: 'sine', minGap: 0.2, poly: 4, choir: 1, rev: 2.2, cutoff: 1200 },
  clicks: { name: 'Minimal Clicks', pad: 0, voice: 'click', minGap: 0.07, poly: 4, choir: 0, rev: 0.6, cutoff: 4000 },
  pure: { name: 'Pure Data Sonification', pad: 0.25, voice: 'bell', minGap: 0.09, poly: 6, choir: 0.6, rev: 0.9, cutoff: 2500 },
};

// ───────── engine ─────────
export class AudioEngine {
  constructor() { this.ctx = null; this.on = false; this.style = 'lab'; this.vol = { master: 0.35, score: 0.5, tokens: 0.6, choir: 0.35, sfx: 0.6 }; this.revSize = 1; this.bpm = 96; this.sync = false; this.voice = false; this.muted = false; this.level = 0; this.events = []; this.hist = { ent: [], ids: [], probs: [], norms: [] }; this.lastAnom = 0; this.onAnomaly = null; this.harm = { mode: 'pentatonic', root: 48 }; this.lastNote = 0; this.active = 0; }
  async start() {
    if (this.ctx) { await this.ctx.resume(); return; }
    const C = (this.ctx = new (window.AudioContext || window.webkitAudioContext)({ latencyHint: 'playback' })), t = C.currentTime;
    this.master = C.createGain(); this.comp = C.createDynamicsCompressor(); this.comp.threshold.value = -20; this.comp.ratio.value = 3; this.comp.attack.value = 0.01;
    this.an = C.createAnalyser(); this.an.fftSize = 512; this.master.connect(this.comp).connect(this.an).connect(C.destination); this.abuf = new Uint8Array(this.an.frequencyBinCount);
    this.rev = C.createConvolver(); this.revGain = C.createGain(); this.revGain.gain.value = 0.25; this.rev.connect(this.revGain).connect(this.master); this.makeIR();
    this.bus = {}; for (const k of ['score', 'tokens', 'choir', 'sfx']) { const g = C.createGain(); g.connect(this.master); const s = C.createGain(); s.gain.value = 0.5; g.connect(s).connect(this.rev); this.bus[k] = g; }
    // warm pad: triangle/sine triad per chord tone → gentle lowpass
    this.padF = C.createBiquadFilter(); this.padF.type = 'lowpass'; this.padF.Q.value = 0.5; this.padF.frequency.value = 900; this.padG = C.createGain(); this.padG.gain.value = 0; this.padF.connect(this.padG).connect(this.bus.score);
    this.pad = []; for (let i = 0; i < 4; i++) { const o = C.createOscillator(); o.type = i % 2 ? 'sine' : 'triangle'; o.start(t); const g = C.createGain(); g.gain.value = 0.08; o.connect(g).connect(this.padF); this.pad.push(o); }
    // divergence: consonant interval voice above the pad
    this.divO = C.createOscillator(); this.divO.type = 'sine'; this.divG = C.createGain(); this.divG.gain.value = 0; this.divO.connect(this.divG).connect(this.padF); this.divO.start(t);
    // layer choir: 8 soft sines (one per layer), gain ← layer residual norm; head texture: soft FM shimmer, index ← attention entropy
    this.choir = []; for (let l = 0; l < 8; l++) { const o = C.createOscillator(); o.type = 'sine'; o.start(t); const g = C.createGain(); g.gain.value = 0; const p = C.createStereoPanner(); p.pan.value = (l / 7) * 1.2 - 0.6; o.connect(g).connect(p).connect(this.bus.choir); this.choir.push({ o, g }); }
    this.fmC = C.createOscillator(); this.fmM = C.createOscillator(); this.fmI = C.createGain(); this.fmI.gain.value = 0; this.fmM.connect(this.fmI).connect(this.fmC.frequency); this.fmG = C.createGain(); this.fmG.gain.value = 0;
    this.fmC.connect(this.fmG).connect(this.bus.choir); this.fmC.start(t); this.fmM.start(t);
    this.on = true; this.applyStyle(); this.applyVol(); this.setHarmony(this.harm);
    this.timer = setInterval(() => { this.an.getByteFrequencyData(this.abuf); let s = 0; for (let i = 0; i < 64; i++) s += this.abuf[i]; this.level = s / (64 * 255); }, 50);
  }
  makeIR() { const C = this.ctx, sec = STYLES[this.style].rev * this.revSize, n = Math.max(1, Math.floor(C.sampleRate * sec)), b = C.createBuffer(2, n, C.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = b.getChannelData(ch); let lp = 0; for (let i = 0; i < n; i++) { lp = lp * 0.85 + (Math.random() * 2 - 1) * 0.15; d[i] = lp * Math.pow(1 - i / n, 4); } } this.rev.buffer = b; }
  applyVol() { if (!this.ctx) return; const t = this.ctx.currentTime; this.master.gain.setTargetAtTime(this.muted ? 0 : this.vol.master, t, 0.08); for (const k in this.bus) this.bus[k].gain.setTargetAtTime(this.vol[k], t, 0.08); }
  setMute(m) { this.muted = m; this.applyVol(); }
  applyStyle() { if (!this.ctx) return; const S = STYLES[this.style], t = this.ctx.currentTime; this.padG.gain.setTargetAtTime(0.5 * S.pad, t, 1); this.padF.frequency.setTargetAtTime(S.cutoff * 0.5, t, 1); this.makeIR(); }
  setHarmony({ mode, root }) { this.harm = { mode, root }; if (!this.ctx) return; const t = this.ctx.currentTime, tc = 2;
    this.pad.forEach((o, i) => o.frequency.setTargetAtTime(midiToHz(degreeToMidi([0, 2, 4, 5][i] ?? 0, root - 12, 'pentatonic')), t, tc)); // root, 3rd, 5th, 6th: always consonant
    this.choir.forEach((v, l) => v.o.frequency.setTargetAtTime(midiToHz(degreeToMidi(l, root, 'pentatonic')), t, tc));
    this.fmC.frequency.setTargetAtTime(midiToHz(root + 24), t, tc); this.fmM.frequency.setTargetAtTime(midiToHz(root + 24) * 2, t, tc); }
  // single soft note. voices: sine, pluck (marimba-ish: sine + 4x partial, fast decay), bell (FM 1:3.5 decaying index), click (very short filtered sine)
  note(t, hz, { v = 'sine', amp = 0.15, dur = 0.5, pan = 0, dest, bright = 0.5 } = {}) {
    const C = this.ctx; if (this.active >= 8) return; this.active++; const g = C.createGain(), p = C.createStereoPanner(); p.pan.value = pan * 0.7; g.connect(p).connect(dest || this.bus.sfx);
    const atk = v === 'click' ? 0.002 : v === 'pluck' ? 0.004 : 0.015, d = v === 'click' ? 0.06 : v === 'pluck' ? Math.min(dur, 0.45) : dur;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(amp, t + atk); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    const o = C.createOscillator(); o.type = v === 'click' ? 'triangle' : 'sine'; o.frequency.value = hz; o.connect(g); o.start(t); o.stop(t + d + 0.05);
    if (v === 'pluck') { const o2 = C.createOscillator(), g2 = C.createGain(); o2.frequency.value = hz * 4; g2.gain.setValueAtTime(amp * 0.25 * (0.4 + bright), t); g2.gain.exponentialRampToValueAtTime(0.0001, t + 0.08); o2.connect(g2).connect(g); o2.start(t); o2.stop(t + 0.1); }
    if (v === 'bell') { const m = C.createOscillator(), mi = C.createGain(); m.frequency.value = hz * 3.5; mi.gain.setValueAtTime(hz * (0.5 + 1.5 * bright), t); mi.gain.exponentialRampToValueAtTime(1, t + d); m.connect(mi).connect(o.frequency); m.start(t); m.stop(t + d + 0.05); }
    o.onended = () => this.active--;
  }
  grid(t) { if (!this.sync) return t; const spb = 60 / this.bpm / 2; return Math.ceil(t / spb) * spb; }
  token(e) { // e: {id, text, p, rank, ent, norms, pats, lp, lpClean, top2, resid}
    if (!this.on || this.muted) return; const C = this.ctx, now = C.currentTime, S = STYLES[this.style];
    if (e.resid && this.hist.ids.length % 8 === 0) this.setHarmony(modeFromHidden(e.resid));
    const { mode, root } = this.harm, tb = timbreFromNorms(e.norms), af = attentionFocus(e.pats), ten = tension(e.ent);
    const t = this.grid(now + 0.03);
    if (allowNote(t, this.lastNote, S.minGap) && this.active < S.poly) { this.lastNote = t; const hz = midiToHz(tokenPitch(e.p, e.rank, root, mode));
      this.note(t, hz, { v: S.voice, amp: 0.08 + 0.06 * Math.min(1, e.p * 2), dur: 0.35 + 0.4 * (1 - ten), pan: af.pan, dest: this.bus.tokens, bright: tb.bright });
      const ac = accent(e.p); if (ac > 0 && this.active < S.poly) this.note(t + 0.04, hz * 2, { v: 'bell', amp: 0.03 + 0.03 * ac, dur: 0.6, pan: af.pan, dest: this.bus.tokens, bright: 0.2 }); }
    this.padF.frequency.setTargetAtTime(S.cutoff * (0.35 + 0.5 * ten), now, 0.8);
    if (e.norms && S.choir) { const mx = Math.max(...e.norms.slice(1)) || 1; this.choir.forEach((v, l) => v.g.gain.setTargetAtTime(0.012 * S.choir * ((e.norms[l + 1] ?? 0) / mx) ** 2, now, 0.4)); }
    this.fmI.gain.setTargetAtTime(midiToHz(root + 24) * 0.6 * af.ent, now, 0.5); this.fmG.gain.setTargetAtTime(0.006 * af.ent * S.choir, now, 0.6);
    if (e.lpClean) { const kl = klDiv(e.lp, e.lpClean), dv = divergenceVoice(kl); this.lastKL = kl; if (dv.interval) this.divO.frequency.setTargetAtTime(midiToHz(root + dv.interval), now, 0.3); this.divG.gain.setTargetAtTime(0.05 * dv.gain, now, 0.5); }
    const H = this.hist; H.ent.push(e.ent); H.ids.push(e.id); H.probs.push(e.top2 || [0, 0]); H.norms.push(e.norms ? e.norms[e.norms.length - 1] : 0); for (const k in H) if (H[k].length > 48) H[k].shift();
    const ph = detectPhenomena(H); if (ph.length && now - this.lastAnom > 4) { this.lastAnom = now; this.anomaly(ph[0]); }
  }
  resetHistory() { this.hist = { ent: [], ids: [], probs: [], norms: [] }; }
  edit(kind) { if (!this.on || this.muted) return; const c = EDIT_CHIMES[kind] || EDIT_CHIMES.generic, t = this.ctx.currentTime + 0.02, { root } = this.harm;
    c.deg.forEach((d, i) => this.note(t + i * c.gap, midiToHz(degreeToMidi(d, root + 24, 'pentatonic')), { v: c.v, amp: c.v === 'click' ? 0.1 : 0.07, dur: 0.5, pan: (i - (c.deg.length - 1) / 2) * 0.3 })); }
  anomaly(type) { this.events.push({ type, t: performance.now() }); this.onAnomaly && this.onAnomaly(type); if (!this.on || this.muted) return; const t = this.ctx.currentTime + 0.02, { root } = this.harm;
    this.note(t, midiToHz(root + 31), { v: 'sine', amp: 0.05, dur: 0.4 }); this.note(t + 0.12, midiToHz(root + 36), { v: 'sine', amp: 0.05, dur: 0.6 }); } // soft rising fifth→octave notification
}
