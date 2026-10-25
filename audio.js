// NEURALESE audio: procedural sonification engine (Web Audio + AudioWorklet). Everything is synthesized; no samples.
// The pure mapping functions at the top are unit-tested (test/audio.test.mjs) and have no Web Audio dependency.

// ───────── pure data → sound mappings ─────────
export const MODES = { phrygian: [0, 1, 3, 5, 7, 8, 10], aeolian: [0, 2, 3, 5, 7, 8, 10], dorian: [0, 2, 3, 5, 7, 9, 10], locrian: [0, 1, 3, 5, 6, 8, 10], harmonic: [0, 2, 3, 5, 7, 8, 11], wholetone: [0, 2, 4, 6, 8, 10], octatonic: [0, 1, 3, 4, 6, 7, 9, 10] };
const MODE_ORDER = ['dorian', 'aeolian', 'harmonic', 'phrygian', 'locrian', 'octatonic', 'wholetone']; // ordered bright → alien
export const midiToHz = (m) => 440 * 2 ** ((m - 69) / 12);
// Hidden-state statistics → {mode, root}. skew/kurtosis of the residual vector choose the mode (heavier tails = more alien);
// the dominant dimension index picks the root pitch class.
export function hiddenStats(x) {
  const n = x.length; let mu = 0; for (const v of x) mu += v; mu /= n; let m2 = 0, m3 = 0, m4 = 0, amax = 0, imax = 0;
  for (let i = 0; i < n; i++) { const c = x[i] - mu; m2 += c * c; m3 += c * c * c; m4 += c * c * c * c; if (Math.abs(x[i]) > amax) { amax = Math.abs(x[i]); imax = i; } }
  m2 /= n; m3 /= n; m4 /= n; const sd = Math.sqrt(m2) || 1e-9; return { mean: mu, sd, skew: m3 / sd ** 3, kurt: m4 / (m2 * m2 || 1e-18) - 3, imax, norm: Math.sqrt(m2 * n + mu * mu * n) };
}
export function modeFromHidden(x) {
  const s = hiddenStats(x); const k = Math.max(0, Math.min(MODE_ORDER.length - 1, Math.floor(Math.log2(1 + Math.max(0, s.kurt)) * 1.2)));
  const mode = MODE_ORDER[s.skew < 0 ? Math.min(MODE_ORDER.length - 1, k + 1) : k]; return { mode, root: 33 + (s.imax % 12), stats: s }; // root in MIDI 33..44 (A1..G#2)
}
// Quantize an integer scale degree to MIDI using a mode.
export function degreeToMidi(deg, root, mode) { const sc = MODES[mode] || MODES.aeolian, n = sc.length, o = Math.floor(deg / n), i = ((deg % n) + n) % n; return root + 12 * o + sc[i]; }
// Token pitch: confident tokens sit high and consonant, improbable ones low. rank 0 → degree 14 (two octaves up); each decade of rank drops a degree.
export function tokenPitch(p, rank, root, mode) { const deg = Math.round(14 + Math.log10(Math.max(p, 1e-9)) * 2.5 - Math.log10(1 + rank) * 1.5); return degreeToMidi(Math.max(0, Math.min(24, deg)), root + 24, mode); }
// Residual norms per slot → timbre: brightness = late/early norm growth, roughness = variance across layers. Both in [0,1].
export function timbreFromNorms(norms) {
  if (!norms || norms.length < 2) return { bright: 0.5, rough: 0 }; const a = norms[0] || 1e-9, b = norms[norms.length - 1];
  const mu = norms.reduce((s, v) => s + v, 0) / norms.length, vr = norms.reduce((s, v) => s + (v - mu) ** 2, 0) / norms.length;
  return { bright: Math.max(0, Math.min(1, Math.log2(b / a + 1e-9) / 5)), rough: Math.max(0, Math.min(1, Math.sqrt(vr) / (mu || 1))) };
}
// Attention focus → stereo pan: centre of attention mass relative to the query position (0 = attends to BOS → hard left, 1 = self → hard right),
// averaged over heads. Also returns mean normalized attention entropy (0 = focused, 1 = uniform).
export function attentionFocus(pats) {
  if (!pats || !pats.length) return { pan: 0, ent: 0 }; let com = 0, ent = 0;
  for (const p of pats) { const T = p.length; let c = 0, h = 0; for (let j = 0; j < T; j++) { c += p[j] * (T > 1 ? j / (T - 1) : 1); if (p[j] > 0) h -= p[j] * Math.log(p[j]); } com += c; ent += T > 1 ? h / Math.log(T) : 0; }
  return { pan: Math.max(-1, Math.min(1, (com / pats.length) * 2 - 1)), ent: ent / pats.length };
}
// Entropy (nats) → tension 0..1 (saturating; ~4 nats ≈ 0.86).
export const tension = (H) => 1 - Math.exp(-Math.max(0, H) / 2);
// Surprisal (−ln p) above threshold → glitch intensity 0..1.
export const glitchAmount = (p, thr = 4) => Math.max(0, Math.min(1, (-Math.log(Math.max(p, 1e-12)) - thr) / 6));
// KL(P‖Q) from two log-prob arrays (nats).
export function klDiv(lpP, lpQ) { let k = 0; for (let i = 0; i < lpP.length; i++) { const p = Math.exp(lpP[i]); if (p > 1e-12) k += p * (lpP[i] - lpQ[i]); } return Math.max(0, k); }
// KL → beat frequency of the dissonance pair (Hz): 0 when identical, ~12 Hz roughness by 2 nats, capped at 30.
export const beatHz = (kl) => Math.min(30, 6 * Math.log1p(kl * 4));
// Phenomena detector over a rolling history. h = {ent:[], ids:[], probs:[[p1,p2]], norms:[]}. Returns list of event types.
export function detectPhenomena(h) {
  const out = [], n = h.ent.length;
  if (n >= 8) { const early = h.ent.slice(0, n - 4), late = h.ent.slice(n - 4); const me = early.reduce((a, b) => a + b, 0) / early.length; if (me > 1.2 && late.every((e) => e < 0.15)) out.push('entropy_collapse'); }
  const ids = h.ids; for (let per = 1; per <= 8; per++) { const need = per * 3; if (ids.length < need) break; let ok = true; for (let i = ids.length - need; i < ids.length - per; i++) if (ids[i] !== ids[i + per]) { ok = false; break; } if (ok) { out.push('repetition_loop'); break; } }
  const pp = h.probs[h.probs.length - 1]; if (pp && pp[0] > 0.3 && pp[1] > 0.3 && Math.abs(pp[0] - pp[1]) < 0.08) out.push('superposition');
  const nm = h.norms; if (nm.length >= 6) { const s = nm.slice(0, -1).slice().sort((a, b) => a - b), med = s[s.length >> 1]; if (nm[nm.length - 1] > 3 * med) out.push('residual_explosion'); }
  return out;
}
// Edit label → SFX kind.
export function editKind(label) {
  const s = label.toLowerCase();
  if (/rome/.test(s)) return 'rome'; if (/svd|low-rank|rank-/.test(s)) return 'svd'; if (/int[248]|quant/.test(s)) return 'quant'; if (/chaos|noise/.test(s)) return 'chaos';
  if (/steer|vector|sae/.test(s)) return 'steer'; if (/swap|duplicate|delete s|slot|program|lerp|←/.test(s)) return 'swap'; if (/zero|mean|resample|ablat|skip|restore|n\d+ /.test(s)) return 'ablate'; if (/undo|reset|import/.test(s)) return 'swap'; return 'generic';
}
// Simple letter → vowel formants (F1,F2,F3 Hz) for the whisper voice.
const VOW = { a: [800, 1150, 2900], e: [400, 1600, 2700], i: [350, 1700, 2700], o: [450, 800, 2830], u: [325, 700, 2530] };
export function formantsFor(ch) { const c = ch.toLowerCase(); if (VOW[c]) return VOW[c]; const code = c.charCodeAt(0) || 0; return Object.values(VOW)[code % 5]; }
export const STYLES = {
  tannhauser: { name: 'Tannhäuser drone', drone: 0.9, brass: 1, pulse: 0.5, industrial: 0, sat: 0.15, cutoff: 900, wave: 'sawtooth', rev: 4.5 },
  zion: { name: 'Zion industrial', drone: 0.6, brass: 0.3, pulse: 1, industrial: 1, sat: 0.6, cutoff: 1400, wave: 'square', rev: 2.2 },
  void: { name: 'Void ambient', drone: 0.7, brass: 0.6, pulse: 0, industrial: 0, sat: 0, cutoff: 500, wave: 'triangle', rev: 8 },
  raw: { name: 'Raw sonification', drone: 0, brass: 0, pulse: 0, industrial: 0, sat: 0, cutoff: 3000, wave: 'sine', rev: 1.2 },
};

// ───────── AudioWorklet: sample-rate decimator + bitcrusher (quantization SFX / ablation crush) ─────────
const WORKLET = `class Decim extends AudioWorkletProcessor{static get parameterDescriptors(){return[{name:'factor',defaultValue:1,minValue:1,maxValue:64},{name:'bits',defaultValue:24,minValue:1,maxValue:24}]}
constructor(){super();this.h=[0,0];this.c=0}
process(i,o,p){const a=i[0],b=o[0];if(!a||!a.length)return true;const F=p.factor,B=p.bits;for(let ch=0;ch<b.length;ch++){const x=a[ch]||a[0],y=b[ch];let c=this.c;for(let n=0;n<y.length;n++){const f=F.length>1?F[n]:F[0],bt=B.length>1?B[n]:B[0];if(c<=0){const q=Math.pow(2,bt-1);this.h[ch]=Math.round(x[n]*q)/q;c=f}y[n]=this.h[ch];c-=1}if(ch===b.length-1)this.c=c}return true}}
registerProcessor('decim',Decim);`;

// ───────── engine ─────────
export class AudioEngine {
  constructor() { this.ctx = null; this.on = false; this.style = 'tannhauser'; this.vol = { master: 0.7, score: 0.6, tokens: 0.7, choir: 0.45, sfx: 0.8 }; this.revSize = 1; this.bpm = 84; this.sync = true; this.voice = false; this.muted = false; this.level = 0; this.events = []; this.hist = { ent: [], ids: [], probs: [], norms: [] }; this.lastAnom = 0; this.onAnomaly = null; this.harm = { mode: 'aeolian', root: 33 }; }
  async start() {
    if (this.ctx) { await this.ctx.resume(); return; }
    const C = (this.ctx = new (window.AudioContext || window.webkitAudioContext)({ latencyHint: 'playback' })), t = C.currentTime;
    this.master = C.createGain(); this.comp = C.createDynamicsCompressor(); this.comp.threshold.value = -14; this.comp.ratio.value = 4;
    this.an = C.createAnalyser(); this.an.fftSize = 512; this.master.connect(this.comp).connect(this.an).connect(C.destination); this.abuf = new Uint8Array(this.an.frequencyBinCount);
    this.rev = C.createConvolver(); this.revGain = C.createGain(); this.revGain.gain.value = 0.55; this.rev.connect(this.revGain).connect(this.master); this.makeIR();
    this.bus = {}; for (const k of ['score', 'tokens', 'choir', 'sfx']) { const g = C.createGain(); g.connect(this.master); const s = C.createGain(); s.gain.value = k === 'tokens' ? 0.35 : 0.6; g.connect(s).connect(this.rev); this.bus[k] = g; }
    // score chain: drone → (worklet decimator) → saturator → lowpass → score bus
    this.decim = null; try { await C.audioWorklet.addModule(URL.createObjectURL(new Blob([WORKLET], { type: 'application/javascript' }))); this.decim = new AudioWorkletNode(C, 'decim', { outputChannelCount: [2] }); } catch (e) { console.warn('AudioWorklet unavailable, decimator disabled', e); }
    this.scoreIn = C.createGain(); this.sat = C.createWaveShaper(); this.lp = C.createBiquadFilter(); this.lp.type = 'lowpass'; this.lp.Q.value = 4;
    (this.decim ? this.scoreIn.connect(this.decim).connect(this.sat) : this.scoreIn.connect(this.sat)); this.sat.connect(this.lp).connect(this.bus.score);
    this.droneOsc = []; this.droneG = C.createGain(); this.droneG.connect(this.scoreIn);
    for (const det of [-11, -4, 0, 5, 12]) { const o = C.createOscillator(); o.detune.value = det; o.start(t); const g = C.createGain(); g.gain.value = 0.07; o.connect(g).connect(this.droneG); this.droneOsc.push(o); }
    this.lfo = C.createOscillator(); this.lfo.frequency.value = 0.07; this.lfoG = C.createGain(); this.lfoG.gain.value = 300; this.lfo.connect(this.lfoG).connect(this.lp.frequency); this.lfo.start(t);
    // sub pulse
    this.sub = C.createOscillator(); this.sub.type = 'sine'; this.subG = C.createGain(); this.subG.gain.value = 0; this.sub.connect(this.subG).connect(this.bus.score); this.sub.start(t);
    // brass pad (2 detuned saws per chord tone through a swelling lowpass)
    this.brass = []; this.brassF = C.createBiquadFilter(); this.brassF.type = 'lowpass'; this.brassF.frequency.value = 300; this.brassG = C.createGain(); this.brassG.gain.value = 0; this.brassF.connect(this.brassG).connect(this.scoreIn);
    for (let i = 0; i < 6; i++) { const o = C.createOscillator(); o.type = 'sawtooth'; o.detune.value = (i % 2 ? 7 : -7); o.start(t); const g = C.createGain(); g.gain.value = 0.05; o.connect(g).connect(this.brassF); this.brass.push(o); }
    // layer choir: 8 voices, saw → two formant bandpasses → gain (amplitude follows layer activation norms)
    this.choir = []; const vow = ['a', 'o', 'u', 'e', 'i', 'a', 'o', 'e'];
    for (let l = 0; l < 8; l++) { const o = C.createOscillator(); o.type = 'sawtooth'; o.start(t); const vib = C.createOscillator(); vib.frequency.value = 4.5 + l * 0.37; const vg = C.createGain(); vg.gain.value = 6; vib.connect(vg).connect(o.detune); vib.start(t);
      const g = C.createGain(); g.gain.value = 0; const pan = C.createStereoPanner(); pan.pan.value = (l / 7) * 1.6 - 0.8; const f = formantsFor(vow[l]);
      for (const [fq, q] of [[f[0], 8], [f[1], 10]]) { const bp = C.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = fq; bp.Q.value = q; o.connect(bp).connect(g); }
      g.connect(pan).connect(this.bus.choir); this.choir.push({ o, g }); }
    // head texture: FM pair, index ← attention entropy; plus granular dust density ← entropy
    this.fmC = C.createOscillator(); this.fmM = C.createOscillator(); this.fmI = C.createGain(); this.fmI.gain.value = 0; this.fmM.connect(this.fmI).connect(this.fmC.frequency); this.fmG = C.createGain(); this.fmG.gain.value = 0.0;
    this.fmC.connect(this.fmG).connect(this.bus.choir); this.fmC.start(t); this.fmM.start(t);
    // divergence beating pair: two sines detuned by beatHz(KL)
    this.bA = C.createOscillator(); this.bB = C.createOscillator(); this.bG = C.createGain(); this.bG.gain.value = 0; for (const o of [this.bA, this.bB]) { o.connect(this.bG); o.start(t); } this.bG.connect(this.bus.score);
    this.noise = C.createBuffer(1, C.sampleRate * 2, C.sampleRate); const nd = this.noise.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    this.on = true; this.applyStyle(); this.applyVol(); this.setHarmony(this.harm); this.scheduler();
  }
  makeIR() { const C = this.ctx, sec = STYLES[this.style].rev * this.revSize, n = Math.max(1, Math.floor(C.sampleRate * sec)), b = C.createBuffer(2, n, C.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = b.getChannelData(ch); let lp = 0; for (let i = 0; i < n; i++) { const env = Math.pow(1 - i / n, 3.2); lp = lp * 0.6 + (Math.random() * 2 - 1) * 0.4; d[i] = (i < C.sampleRate * 0.03 && Math.random() < 0.002 ? 3 : 1) * lp * env; } } this.rev.buffer = b; }
  applyVol() { if (!this.ctx) return; const t = this.ctx.currentTime; this.master.gain.setTargetAtTime(this.muted ? 0 : this.vol.master, t, 0.05); for (const k in this.bus) this.bus[k].gain.setTargetAtTime(this.vol[k], t, 0.05); }
  setMute(m) { this.muted = m; this.applyVol(); }
  applyStyle() { if (!this.ctx) return; const S = STYLES[this.style], t = this.ctx.currentTime; this.droneOsc.forEach((o) => (o.type = S.wave)); this.droneG.gain.setTargetAtTime(S.drone, t, 0.5); this.lp.frequency.setTargetAtTime(S.cutoff, t, 0.5);
    const k = S.sat * 40, c = new Float32Array(1024); for (let i = 0; i < 1024; i++) { const x = i / 511.5 - 1; c[i] = k ? ((1 + k) * x) / (1 + k * Math.abs(x)) : x; } this.sat.curve = c; this.makeIR(); }
  setHarmony({ mode, root }) { this.harm = { mode, root }; if (!this.ctx) return; const t = this.ctx.currentTime, tc = 1.5;
    this.droneOsc.forEach((o, i) => o.frequency.setTargetAtTime(midiToHz(root + [0, 0, 7, 12, 0][i]), t, tc)); this.sub.frequency.setTargetAtTime(midiToHz(root - 12), t, tc);
    this.brass.forEach((o, i) => o.frequency.setTargetAtTime(midiToHz(degreeToMidi([0, 2, 4, 7, 9, 11][i], root + 24, mode)), t, tc));
    this.choir.forEach((v, l) => v.o.frequency.setTargetAtTime(midiToHz(degreeToMidi(l * 2, root + 24, mode)), t, tc));
    this.fmC.frequency.setTargetAtTime(midiToHz(root + 48), t, tc); this.fmM.frequency.setTargetAtTime(midiToHz(root + 48) * 1.414, t, tc); this.bA.frequency.setTargetAtTime(midiToHz(root + 36), t, tc); }
  // look-ahead scheduler for the BPM pulse / industrial hats (runs on a timer, schedules ~200 ms ahead on the audio clock)
  scheduler() { const C = this.ctx; this.nextBeat = C.currentTime + 0.1; this.beatN = 0;
    this.timer = setInterval(() => { if (!this.on) return; const S = STYLES[this.style], spb = 60 / this.bpm / 2;
      while (this.nextBeat < C.currentTime + 0.2) { const t = this.nextBeat, n = this.beatN++;
        if (S.pulse && n % 2 === 0) { const g = this.subG.gain; g.cancelScheduledValues(t); g.setValueAtTime(0.0001, t); g.linearRampToValueAtTime(0.5 * S.pulse * (n % 8 === 0 ? 1 : 0.6), t + 0.01); g.exponentialRampToValueAtTime(0.0001, t + spb * 1.6); }
        if (S.industrial && n % 2 === 1) this.noiseHit(t, 7000 + 2000 * Math.random(), 0.05, 0.15 * S.industrial, (Math.random() - 0.5) * 0.6, this.bus.score);
        this.nextBeat += spb; }
      this.an.getByteFrequencyData(this.abuf); let s = 0; for (let i = 0; i < 64; i++) s += this.abuf[i]; this.level = s / (64 * 255); }, 25); }
  grid(t) { if (!this.sync) return t; const spb = 60 / this.bpm / 4, b = this.nextBeat - 60 / this.bpm / 2; return Math.max(t, b + Math.ceil((t - b) / spb) * spb); }
  noiseHit(t, freq, dur, amp, pan, dest, q = 1, type = 'bandpass') { const C = this.ctx, s = C.createBufferSource(); s.buffer = this.noise; s.loopStart = Math.random(); s.loop = true; const f = C.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q; const g = C.createGain(), p = C.createStereoPanner(); p.pan.value = pan;
    g.gain.setValueAtTime(amp, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); s.connect(f).connect(g).connect(p).connect(dest || this.bus.sfx); s.start(t, Math.random()); s.stop(t + dur + 0.05); }
  tone(t, hz, dur, amp, { type = 'sine', pan = 0, dest, attack = 0.005, glideTo = null, detune = 0 } = {}) { const C = this.ctx, o = C.createOscillator(); o.type = type; o.frequency.setValueAtTime(hz, t); o.detune.value = detune; if (glideTo) o.frequency.exponentialRampToValueAtTime(glideTo, t + dur);
    const g = C.createGain(), p = C.createStereoPanner(); p.pan.value = pan; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(amp, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); o.connect(g).connect(p).connect(dest || this.bus.sfx); o.start(t); o.stop(t + dur + 0.05); return o; }

  // ───── data inputs ─────
  // Called once per generated token with real model quantities.
  token(e) { // e: {id, text, p, rank, ent, norms, pats, lp, lpClean, top2, resid}
    if (!this.on || this.muted) return; const C = this.ctx, now = C.currentTime, t = this.grid(now + 0.03), S = STYLES[this.style];
    if (e.resid && (this.hist.ids.length % 8 === 0)) this.setHarmony(modeFromHidden(e.resid));
    const { mode, root } = this.harm, midi = tokenPitch(e.p, e.rank, root, mode), tb = timbreFromNorms(e.norms), af = attentionFocus(e.pats), ten = tension(e.ent), gl = glitchAmount(e.p);
    // token blip: pitch ← p/rank, timbre ← residual norms (filter + FM-ish detune), pan ← attention focus
    const f = C.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 400 + 6000 * tb.bright; f.Q.value = 2 + 10 * tb.rough; f.connect(this.bus.tokens);
    this.tone(t, midiToHz(midi), 0.25 + 0.4 * (1 - ten), 0.22, { type: tb.rough > 0.4 ? 'square' : 'triangle', pan: af.pan, dest: f });
    this.tone(t, midiToHz(midi) * (2 + tb.rough), 0.12, 0.06, { pan: -af.pan, dest: f, detune: 20 * tb.rough });
    if (gl > 0) this.glitch(t, gl, af.pan);
    // score tension ← entropy
    this.lp.frequency.setTargetAtTime(S.cutoff * (0.6 + 1.8 * ten), now, 0.4); this.droneOsc.forEach((o, i) => o.detune.setTargetAtTime([-11, -4, 0, 5, 12][i] * (1 + 3 * ten), now, 0.6));
    if (S.brass) { const g = this.brassG.gain; g.setTargetAtTime(0.25 * S.brass * ten, now, 1.2); this.brassF.frequency.setTargetAtTime(250 + 2200 * ten * ten, now, 1.5); }
    // choir ← per-layer norms; head FM ← attention entropy
    if (e.norms) { const mx = Math.max(...e.norms.slice(1)) || 1; this.choir.forEach((v, l) => v.g.gain.setTargetAtTime(0.05 * ((e.norms[l + 1] ?? 0) / mx) ** 2, now, 0.15)); }
    this.fmI.gain.setTargetAtTime(midiToHz(root + 48) * 4 * af.ent, now, 0.2); this.fmG.gain.setTargetAtTime(0.02 + 0.03 * af.ent, now, 0.3);
    if (af.ent > 0.6) for (let i = 0; i < 4; i++) this.noiseHit(t + Math.random() * 0.2, 2000 + 6000 * Math.random(), 0.015, 0.05 * af.ent, Math.random() * 2 - 1, this.bus.choir, 20);
    // divergence beating ← KL(hacked‖clean)
    if (e.lpClean) { const kl = klDiv(e.lp, e.lpClean), bh = beatHz(kl); this.lastKL = kl; this.bB.frequency.setTargetAtTime(this.bA.frequency.value + bh, now, 0.2); this.bG.gain.setTargetAtTime(kl > 0.01 ? Math.min(0.12, 0.03 + kl * 0.04) : 0, now, 0.3); }
    if (this.voice && e.text) this.whisper(t, e.text, af.pan);
    // phenomena
    const H = this.hist; H.ent.push(e.ent); H.ids.push(e.id); H.probs.push(e.top2 || [0, 0]); H.norms.push(e.norms ? e.norms[e.norms.length - 1] : 0); for (const k in H) if (H[k].length > 48) H[k].shift();
    const ph = detectPhenomena(H); if (ph.length && now - this.lastAnom > 3) { this.lastAnom = now; this.anomaly(ph[0]); }
  }
  resetHistory() { this.hist = { ent: [], ids: [], probs: [], norms: [] }; }
  glitch(t, a, pan) { const n = 2 + Math.floor(a * 8), sl = 0.012 + 0.02 * Math.random(); for (let i = 0; i < n; i++) { const tt = t + i * sl * (1 + (Math.random() < 0.3)); if (Math.random() < 0.5) this.noiseHit(tt, 300 + 9000 * Math.random(), sl, 0.25 * a, pan, this.bus.tokens, 3); else this.tone(tt, 60 + 3000 * Math.random(), sl, 0.12 * a, { type: 'square', pan: -pan, dest: this.bus.tokens, attack: 0.001 }); } }
  whisper(t, text, pan) { const C = this.ctx; const chars = text.replace(/[^a-z]/gi, '').slice(0, 6); let tt = t;
    for (const ch of chars) { const s = C.createBufferSource(); s.buffer = this.noise; const g = C.createGain(); g.gain.setValueAtTime(0.0001, tt); g.gain.exponentialRampToValueAtTime(0.25, tt + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, tt + 0.09); const p = C.createStereoPanner(); p.pan.value = pan * 0.5;
      for (const [i, fq] of formantsFor(ch).entries()) { const bp = C.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = fq * (0.85 + 0.1 * (pan + 1)); bp.Q.value = 12 - i * 3; s.connect(bp).connect(g); }
      g.connect(p).connect(this.bus.tokens); s.start(tt, Math.random()); s.stop(tt + 0.12); tt += 0.07; } }
  // ───── edit SFX ─────
  edit(kind, info = {}) {
    if (!this.on || this.muted) return; const C = this.ctx, t = C.currentTime + 0.02, root = midiToHz(this.harm.root + 24);
    switch (kind) {
      case 'svd': { // spectral smear: 12 resonant noise bands sweeping toward one frequency
        for (let i = 0; i < 12; i++) { const s = C.createBufferSource(); s.buffer = this.noise; s.loop = true; const bp = C.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 30; bp.frequency.setValueAtTime(200 * 2 ** (i / 2), t); bp.frequency.exponentialRampToValueAtTime(root * 2, t + 2.2);
          const g = C.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.5, t + 0.3); g.gain.exponentialRampToValueAtTime(0.0001, t + 2.6); const p = C.createStereoPanner(); p.pan.value = (i / 11) * 2 - 1; s.connect(bp).connect(g).connect(p).connect(this.bus.sfx); s.start(t, Math.random() * 1.5); s.stop(t + 2.7); } break; }
      case 'ablate': { // hard cut of the score + bitcrushed burst
        const g = this.bus.score.gain; g.cancelScheduledValues(t); g.setValueAtTime(0, t); g.setValueAtTime(0, t + 0.14); g.linearRampToValueAtTime(this.vol.score, t + 0.6);
        this.crush(t, 1.2, 12, 3); for (let i = 0; i < 6; i++) this.tone(t + i * 0.035, root * (i % 2 ? 0.5 : 1.5), 0.03, 0.2, { type: 'square', attack: 0.001, pan: i % 2 ? -0.7 : 0.7 }); break; }
      case 'rome': { // metallic strike: inharmonic free-bar partials + resonant ping
        [1, 2.756, 5.404, 8.933, 13.34].forEach((r, i) => this.tone(t, root * r, 3.5 / (1 + i * 0.6), 0.25 / (1 + i), { pan: (i % 2 ? 0.4 : -0.4), attack: 0.002 })); this.noiseHit(t, root * 4, 0.6, 0.6, 0, this.bus.sfx, 60); break; }
      case 'quant': { const bits = info.bits || 4; this.crush(t, 3.5, bits === 2 ? 40 : bits === 4 ? 16 : 6, bits === 2 ? 3 : bits === 4 ? 6 : 10); this.tone(t, root * 8, 0.4, 0.1, { type: 'square', glideTo: root, attack: 0.002 }); break; }
      case 'chaos': { for (let i = 0; i < 70; i++) { const tt = t + Math.random() * 1.8, pan = Math.random() * 2 - 1; if (Math.random() < 0.6) this.tone(tt, 80 * 2 ** (Math.random() * 7), 0.02 + Math.random() * 0.06, 0.12, { pan, attack: 0.002, type: Math.random() < 0.5 ? 'sine' : 'sawtooth' }); else this.noiseHit(tt, 500 + Math.random() * 8000, 0.03, 0.2, pan, this.bus.sfx, 8); } break; }
      case 'steer': { // Shepard-tone glide: octave-spaced partials with a raised-cosine spectral envelope, gliding one octave
        const up = (info.coef ?? 1) >= 0, base = 55; for (let k = 0; k < 7; k++) { const f0 = base * 2 ** k, f1 = f0 * (up ? 2 : 0.5), w = Math.sin((Math.PI * (k + 0.5)) / 7) ** 2; this.tone(t, f0, 2.4, 0.12 * w + 0.001, { glideTo: f1, attack: 0.6, pan: (k / 6) * 1.2 - 0.6 }); } break; }
      case 'swap': { // tape stop + reverse swell
        for (const r of [1, 1.5, 2]) { const o = this.tone(t, root * r, 1.1, 0.15, { type: 'sawtooth', glideTo: 18, attack: 0.002 }); }
        const s = C.createBufferSource(); s.buffer = this.noise; const g = C.createGain(); g.gain.setValueAtTime(0.0001, t + 1); g.gain.exponentialRampToValueAtTime(0.4, t + 1.9); g.gain.setValueAtTime(0, t + 1.92); const hp = C.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.setValueAtTime(200, t + 1); hp.frequency.exponentialRampToValueAtTime(6000, t + 1.9); s.connect(hp).connect(g).connect(this.bus.sfx); s.start(t + 1); s.stop(t + 2); break; }
      default: this.tone(t, root * 3, 0.3, 0.15, { type: 'triangle', glideTo: root * 1.5 });
    }
  }
  crush(t, dur, factor, bits) { if (!this.decim) return; const F = this.decim.parameters.get('factor'), B = this.decim.parameters.get('bits'); F.cancelScheduledValues(t); B.cancelScheduledValues(t); F.setValueAtTime(factor, t); B.setValueAtTime(bits, t); F.setValueAtTime(factor, t + dur); B.setValueAtTime(bits, t + dur); F.linearRampToValueAtTime(1, t + dur + 0.8); B.linearRampToValueAtTime(24, t + dur + 0.8); }
  // ───── phenomena ─────
  anomaly(type) {
    const C = this.ctx, t = C.currentTime + 0.02, root = midiToHz(this.harm.root + 12); this.events.push({ type, t: performance.now() }); this.onAnomaly && this.onAnomaly(type);
    if (type === 'entropy_collapse') { for (let k = 0; k < 5; k++) this.tone(t, root * 2 ** k * 1.01, 3, 0.1, { glideTo: root * 2, attack: 0.3, pan: k / 2 - 1 }); }
    else if (type === 'repetition_loop') { for (let i = 0; i < 12; i++) this.tone(t + i * 0.09, root * 4, 0.06, 0.18 * (1 - i / 12), { type: 'square', attack: 0.001, pan: Math.sin(i) }); this.crush(t, 1, 8, 5); }
    else if (type === 'superposition') { for (const r of [1, 1.0595, 1.4983, 1.5874]) this.tone(t, root * 2 * r, 2.5, 0.1, { type: 'sine', attack: 0.4, pan: r > 1.3 ? 0.8 : -0.8 }); this.edit('steer', { coef: 1 }); }
    else { this.tone(t, 30, 1.5, 0.5, { glideTo: 900, type: 'sawtooth', attack: 0.01 }); this.noiseHit(t, 100, 1.2, 0.5, 0, this.bus.sfx, 1, 'lowpass'); }
  }
}
