import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { GPT2Tokenizer } from './tokenizer.js';
import { CFG, buildWeights, parseSafetensors, cloneWeights, Stream, sample, mulberry32 } from './model.js';
import { Hacker } from './hacks.js';
import { PRESETS } from './presets.js';

const REPO = 'https://huggingface.co/roneneldan/TinyStories-8M/resolve';
const ST_URL = `${REPO}/refs%2Fpr%2F1/model.safetensors`; // safetensors conversion of the official weights
const $ = (id) => document.getElementById(id);
const setLoad = (msg, f) => { $('loadmsg').textContent = msg; if (f != null) $('loadbar').style.width = (f * 100).toFixed(1) + '%'; };

async function fetchProgress(url, range, onp) {
  const r = await fetch(url, range ? { headers: { Range: `bytes=${range[0]}-${range[1]}` } } : {});
  if (!r.ok) throw new Error('HTTP ' + r.status);
  const total = range ? range[1] - range[0] + 1 : +r.headers.get('content-length');
  const rd = r.body.getReader(); const chunks = []; let got = 0;
  for (;;) { const { done, value } = await rd.read(); if (done) break; chunks.push(value); got += value.length; onp && onp(got / total); }
  const out = new Uint8Array(got); let o = 0; for (const c of chunks) { out.set(c, o); o += c.length; }
  return { buf: out.buffer, partial: r.status === 206 };
}

async function loadModel() {
  setLoad('reading safetensors header…', 0.01);
  const h8 = await fetchProgress(ST_URL, [0, 7]);
  const n = Number(new DataView(h8.buf).getBigUint64(0, true));
  const hb = await fetchProgress(ST_URL, [8, 8 + n - 1]);
  const header = JSON.parse(new TextDecoder().decode(hb.partial ? hb.buf : hb.buf.slice(8, 8 + n)));
  let end = 0; for (const [k, v] of Object.entries(header)) if (v.dtype === 'F32') end = Math.max(end, v.data_offsets[1]);
  setLoad(`streaming ${(end / 1e6).toFixed(1)} MB of fp32 weights (skipping causal-mask buffers)…`);
  const vocabP = fetch(`${REPO}/main/vocab.json`).then((r) => r.json());
  const mergesP = fetch(`${REPO}/main/merges.txt`).then((r) => r.text());
  const d = await fetchProgress(ST_URL, [8 + n, 8 + n + end - 1], (f) => setLoad(`streaming weights… ${(f * end / 1e6).toFixed(1)} / ${(end / 1e6).toFixed(1)} MB`, f * 0.95));
  const data = d.partial ? d.buf : d.buf.slice(8 + n);
  setLoad('building tokenizer + tensors…', 0.97);
  const W = buildWeights(parseSafetensors(data, n, header));
  const tok = new GPT2Tokenizer(await vocabP, await mergesP);
  return { W, tok, mb: end / 1e6 };
}

// ───────────────────────── 3D scene ─────────────────────────
const canvas = $('gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x04050a);
scene.fog = new THREE.FogExp2(0x04050a, 0.018);
const camera = new THREE.PerspectiveCamera(48, innerWidth / innerHeight, 0.1, 400);
camera.position.set(22, 17, 28);
const controls = new OrbitControls(camera, canvas);
controls.target.set(0, 8.4, 0); controls.enableDamping = true; controls.autoRotate = true; controls.autoRotateSpeed = 0.35;
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.72, 0.5, 0.22);
composer.addPass(bloom); composer.addPass(new OutputPass());
scene.add(new THREE.AmbientLight(0x6070ff, 0.5));
const pl = new THREE.PointLight(0x4df3ff, 60, 60); pl.position.set(0, 20, 0); scene.add(pl);

// starfield
{ const g = new THREE.BufferGeometry(), N = 2500, p = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) { const r = 60 + Math.random() * 120, t = Math.random() * 6.283, u = Math.acos(2 * Math.random() - 1); p.set([r * Math.sin(u) * Math.cos(t), r * Math.cos(u), r * Math.sin(u) * Math.sin(t)], i * 3); }
  g.setAttribute('position', new THREE.BufferAttribute(p, 3));
  scene.add(new THREE.Points(g, new THREE.PointsMaterial({ color: 0x8090ff, size: 0.35, transparent: true, opacity: 0.6 }))); }

const GAP = 2.4, GRID = 32, CELL = 0.2, RING = 4.6;
const layers = []; const pickables = [];
const headGeo = new THREE.SphereGeometry(0.24, 20, 14);
const cellGeo = new THREE.BoxGeometry(CELL * 0.78, 0.05, CELL * 0.78);
function makeLabel(text, color = '#9fb0ff') {
  const c = document.createElement('canvas'); c.width = 256; c.height = 64; const x = c.getContext('2d');
  x.font = '600 30px "JetBrains Mono", monospace'; x.fillStyle = color; x.shadowColor = color; x.shadowBlur = 12; x.fillText(text, 8, 42);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false }));
  s.scale.set(2.6, 0.65, 1); return s;
}
for (let l = 0; l < CFG.L; l++) {
  const g = new THREE.Group(); g.position.y = l * GAP; scene.add(g);
  const slab = new THREE.Mesh(new THREE.CylinderGeometry(RING + 0.7, RING + 0.7, 0.05, 64, 1, true), new THREE.MeshBasicMaterial({ color: 0x2a3480, transparent: true, opacity: 0.18, side: THREE.DoubleSide, depthWrite: false }));
  const disc = new THREE.Mesh(new THREE.CircleGeometry(RING + 0.7, 64), new THREE.MeshBasicMaterial({ color: 0x0c1030, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false }));
  disc.rotation.x = -Math.PI / 2; disc.position.y = -0.04;
  const rim = new THREE.Mesh(new THREE.TorusGeometry(RING + 0.7, 0.025, 8, 128), new THREE.MeshBasicMaterial({ color: l % 2 ? 0xff4fd8 : 0x4df3ff, transparent: true, opacity: 0.55 }));
  rim.rotation.x = Math.PI / 2;
  g.add(slab, disc, rim); disc.userData = { kind: 'layer', l }; pickables.push(disc);
  const cells = new THREE.InstancedMesh(cellGeo, new THREE.MeshBasicMaterial({ color: 0xffffff }), GRID * GRID);
  const m4 = new THREE.Matrix4();
  for (let i = 0; i < GRID * GRID; i++) { m4.makeTranslation((i % GRID - GRID / 2 + 0.5) * CELL, 0, (Math.floor(i / GRID) - GRID / 2 + 0.5) * CELL); cells.setMatrixAt(i, m4); cells.setColorAt(i, new THREE.Color(0x101540)); }
  cells.userData = { kind: 'neuron', l }; g.add(cells); pickables.push(cells);
  const heads = [];
  for (let h = 0; h < CFG.H; h++) {
    const a = (h / CFG.H) * Math.PI * 2;
    const m = new THREE.Mesh(headGeo, new THREE.MeshStandardMaterial({ color: 0x1a2050, emissive: new THREE.Color(0x4df3ff), emissiveIntensity: 0.15, roughness: 0.3, metalness: 0.2 }));
    m.position.set(Math.cos(a) * RING, 0.3, Math.sin(a) * RING); m.userData = { kind: 'head', l, h };
    g.add(m); heads.push(m); pickables.push(m);
  }
  const lab = makeLabel(`L${l} ${l % 2 ? 'local' : 'global'}`, l % 2 ? '#ff8fe6' : '#8ff6ff'); lab.position.set(RING + 2.4, 0.3, 0); g.add(lab);
  layers.push({ g, cells, heads, rim, slab, targetY: l * GAP, act: new Float32Array(1024), headAct: new Float32Array(16), resid: 0 });
}
// residual spine
const spine = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, GAP * 8 + 2, 12), new THREE.MeshBasicMaterial({ color: 0x4df3ff, transparent: true, opacity: 0.35 }));
spine.position.y = GAP * 3.5; scene.add(spine);
const pulses = [];
function firePulse(color = 0xff4fd8) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 12), new THREE.MeshBasicMaterial({ color })); m.position.y = -1.5; scene.add(m); pulses.push(m);
}
// selection marker
const marker = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.035, 8, 40), new THREE.MeshBasicMaterial({ color: 0xffc14d, transparent: true, opacity: 0.7 })); marker.visible = false; scene.add(marker);
// attention heatmap plane
const attC = document.createElement('canvas'); attC.width = attC.height = 256; const attX = attC.getContext('2d');
const attTex = new THREE.CanvasTexture(attC); attTex.magFilter = THREE.NearestFilter;
const attPlane = new THREE.Mesh(new THREE.PlaneGeometry(4, 4), new THREE.MeshBasicMaterial({ map: attTex, transparent: true, opacity: 0.95, side: THREE.DoubleSide }));
attPlane.visible = false; scene.add(attPlane);
const attLab = makeLabel('attention', '#ffc14d'); attLab.visible = false; scene.add(attLab);

const tmpC = new THREE.Color();
function paintLayer(L, editedNeurons, ablated, editedHeads, l) {
  let mx = 1e-6; for (let i = 0; i < 1024; i++) mx = Math.max(mx, Math.abs(L.act[i]));
  for (let i = 0; i < 1024; i++) {
    const v = L.act[i] / mx;
    if (editedNeurons.has(l * 1024 + i)) tmpC.setRGB(1, 0.75, 0.2);
    else if (v >= 0) tmpC.setRGB(0.04 + v * v * 0.4, 0.06 + v * 1.1, 0.18 + v * 1.4);
    else tmpC.setRGB(0.1 - v * 0.9, 0.04, 0.2 - v * 0.6);
    L.cells.setColorAt(i, tmpC);
  }
  L.cells.instanceColor.needsUpdate = true;
  let hm = 1e-6; for (let h = 0; h < 16; h++) hm = Math.max(hm, L.headAct[h]);
  L.heads.forEach((m, h) => {
    const k = l * 16 + h, a = L.headAct[h] / hm;
    if (ablated.has(k)) { m.material.emissive.setHex(0xff2040); m.material.emissiveIntensity = 0.25; m.scale.setScalar(0.7); }
    else { m.material.emissive.setHex(editedHeads.has(k) ? 0xffc14d : 0x4df3ff); m.material.emissiveIntensity = 0.1 + a * 2.2; m.scale.setScalar(0.8 + a * 0.6); }
  });
}

// ───────────────────────── state ─────────────────────────
let W, M, tok, H, running = false, sel = null, curB = null;
const attHist = () => (curB ? curB.attnHist : []);

function editedSets() {
  const n = new Set(), h = new Set();
  for (const e of H.edits) { if (e.type === 'neuron') n.add(e.l * 1024 + e.i); if (e.type === 'head') h.add(e.l * 16 + e.i); }
  return { n, h };
}
function repaint() { const s = editedSets(); layers.forEach((L, l) => paintLayer(L, s.n, H.ablated, s.h, l)); drawAttention(); }

function drawAttention() {
  if (!sel || sel.kind !== 'head' || !attHist().length) { attPlane.visible = attLab.visible = false; return; }
  const hist = attHist(), T = hist.length, slot = H.order.indexOf(sel.l), S = Math.min(T, 256);
  const off = T - S, px = 256 / S;
  attX.fillStyle = '#05060f'; attX.fillRect(0, 0, 256, 256);
  for (let t = off; t < T; t++) {
    const row = hist[t][slot][sel.h];
    for (let s = Math.max(off, 0); s <= t; s++) {
      const v = Math.sqrt(row[s] || 0);
      attX.fillStyle = `rgb(${(40 + v * 215) | 0},${(20 + v * 170) | 0},${(60 + v * 195) | 0})`;
      attX.fillRect((s - off) * px, (t - off) * px, Math.ceil(px), Math.ceil(px));
    }
  }
  attTex.needsUpdate = true;
  const L = layers[sel.l];
  attPlane.position.set(0, L.g.position.y + 2.6, -RING - 2.6); attPlane.visible = true;
  attLab.position.set(0.6, L.g.position.y + 4.9, -RING - 2.6); attLab.visible = true;
}

function topTokens(vec, k = 6) {
  const d = CFG.d, V = CFG.V, sc = new Float32Array(V);
  for (let i = 0; i < V; i++) { let s = 0; const o = i * d; for (let j = 0; j < d; j++) s += M.wte[o + j] * vec[j]; sc[i] = s; }
  const idx = Array.from(sc.keys()); idx.sort((a, b) => sc[b] - sc[a]);
  const f = (i) => `<span class="tk">${esc(tok.tokenStr(i))}</span>`;
  return { pos: idx.slice(0, k).map(f).join(''), neg: idx.slice(-k).reverse().map((i) => f(i).replace('tk', 'tk neg')).join('') };
}
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/\n/g, '↵').replace(/ /g, '·');

function inspect() {
  const el = $('insp'); if (!sel) return;
  const L = layers[sel.l];
  if (sel.kind === 'neuron') {
    const col = new Float32Array(CFG.d); for (let i = 0; i < CFG.d; i++) col[i] = M.layers[sel.l].proj[i * CFG.ff + sel.i];
    const t = topTokens(col);
    el.innerHTML = `<b>MLP neuron L${sel.l}·N${sel.i}</b><br>activation now: <b>${L.act[sel.i].toFixed(3)}</b><br>when it fires it pushes toward:<br>${t.pos}<br>and away from:<br>${t.neg}`;
  } else if (sel.kind === 'head') {
    const k = sel.l * 16 + sel.h, hist = attHist(); let att = '';
    if (hist.length && curB) {
      const row = hist[hist.length - 1][H.order.indexOf(sel.l)][sel.h]; const ids = curB.ids;
      const top = Array.from(row.keys()).sort((a, b) => row[b] - row[a]).slice(0, 4);
      att = '<br>last token attends to:<br>' + top.map((p) => `<span class="tk">${esc(tok.tokenStr(ids[p] ?? 0))} ${(row[p] * 100).toFixed(0)}%</span>`).join('');
    }
    el.innerHTML = `<b>Attention head L${sel.l}·H${sel.h}</b> ${H.ablated.has(k) ? '<span style="color:#ff5470">ABLATED</span>' : ''}<br>${sel.l % 2 ? 'local (256-token window)' : 'global'} · output norm <b>${L.headAct[sel.h].toFixed(3)}</b>${att}<br><i style="color:#7b84b5">heatmap floats behind the stack</i>`;
  } else if (sel.kind === 'layer') {
    el.innerHTML = `<b>Layer ${sel.l}</b> (${sel.l % 2 ? 'local' : 'global'} attention)<br>stack slot ${H.order.indexOf(sel.l)} · residual norm <b>${(L.resid || 0).toFixed(2)}</b><br>16 heads × 16 dims · 1024 GELU neurons<br>edits on it: ${H.edits.filter((e) => e.l === sel.l).length}`;
  } else if (sel.kind === 'embed') {
    el.innerHTML = `<b>Embedding row</b> "${esc($('tTok').value)}" → ids ${tok.encode($('tTok').value).join(',')}<br>tied weights: editing it changes both how the token is read <i>and</i> how likely it is to be written.`;
  }
}

function select(s) {
  sel = s; if (!s) { marker.visible = false; return; }
  $('tgtType').value = s.kind; $('tL').value = s.l; if (s.kind === 'head') $('tI').value = s.h; if (s.kind === 'neuron') $('tI').value = s.i;
  const L = layers[s.l]; marker.visible = true;
  if (s.kind === 'head') { marker.position.copy(L.heads[s.h].getWorldPosition(new THREE.Vector3())); marker.rotation.set(Math.PI / 2, 0, 0); marker.scale.setScalar(1); marker.material.opacity = 0.8; }
  else if (s.kind === 'neuron') { marker.position.set((s.i % GRID - GRID / 2 + 0.5) * CELL, L.g.position.y + 0.08, (Math.floor(s.i / GRID) - GRID / 2 + 0.5) * CELL); marker.rotation.set(Math.PI / 2, 0, 0); marker.scale.setScalar(0.35); marker.material.opacity = 0.9; }
  else { marker.position.set(0, L.g.position.y, 0); marker.rotation.set(Math.PI / 2, 0, 0); marker.scale.setScalar((RING + 1.0) / 0.42); marker.material.opacity = 0.35; }
  drawAttention(); inspect();
}

// picking
const ray = new THREE.Raycaster(), mouse = new THREE.Vector2(); let downAt = null;
function pick(ev) {
  mouse.set((ev.clientX / innerWidth) * 2 - 1, -(ev.clientY / innerHeight) * 2 + 1); ray.setFromCamera(mouse, camera);
  const hits = ray.intersectObjects(pickables, false); if (!hits.length) return null;
  const pr = (h) => (h.object.userData.kind === 'head' ? 0 : h.object.userData.kind === 'neuron' ? 1 : 2);
  hits.sort((a, b) => a.distance - b.distance || pr(a) - pr(b));
  let h = hits[0]; const hd = hits.find((x) => x.object.userData.kind !== 'layer' && x.distance < h.distance + 0.5); if (hd) h = hd;
  const u = h.object.userData;
  if (u.kind === 'neuron') return { kind: 'neuron', l: u.l, i: h.instanceId };
  return { ...u };
}
canvas.addEventListener('pointerdown', (e) => (downAt = [e.clientX, e.clientY]));
canvas.addEventListener('pointerup', (e) => { if (!downAt || Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > 5 || !H) return; const p = pick(e); if (p) select(p); });
canvas.addEventListener('pointermove', (e) => {
  const tip = $('tip'); if (!H) return; const p = pick(e);
  if (!p) { tip.style.display = 'none'; canvas.style.cursor = 'grab'; return; }
  canvas.style.cursor = 'pointer'; tip.style.display = 'block'; tip.style.left = e.clientX + 14 + 'px'; tip.style.top = e.clientY + 10 + 'px';
  tip.textContent = p.kind === 'head' ? `head L${p.l}·H${p.h}  ‖out‖=${layers[p.l].headAct[p.h].toFixed(2)}` : p.kind === 'neuron' ? `neuron L${p.l}·N${p.i}  a=${layers[p.l].act[p.i].toFixed(3)}` : `layer ${p.l}`;
});

addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); composer.setSize(innerWidth, innerHeight); });
const clock = new THREE.Clock();
(function loop() {
  requestAnimationFrame(loop); const dt = Math.min(clock.getDelta(), 0.05), t = clock.elapsedTime;
  controls.update();
  layers.forEach((L, l) => {
    L.g.position.y += (L.targetY - L.g.position.y) * Math.min(1, dt * 4);
    L.rim.material.opacity = 0.35 + Math.min(L.resid / 6, 1) * 0.6 + Math.sin(t * 2 + l) * 0.05;
    L.g.rotation.y = Math.sin(t * 0.2 + l * 0.5) * 0.04;
  });
  for (let i = pulses.length - 1; i >= 0; i--) { const p = pulses[i]; p.position.y += dt * 14; p.scale.setScalar(1 + Math.sin(t * 20) * 0.2); if (p.position.y > GAP * 8 + 1) { scene.remove(p); pulses.splice(i, 1); } }
  marker.rotation.z += dt; if (sel && sel.kind === 'head') marker.position.copy(layers[sel.l].heads[sel.h].getWorldPosition(new THREE.Vector3()));
  attPlane.lookAt(camera.position); attLab.position.y = attPlane.position.y + 2.3;
  composer.render();
})();

// ───────────────────────── generation ─────────────────────────
function append(el, text, cls) { const s = document.createElement('span'); s.className = cls; s.textContent = text; el.appendChild(s); el.scrollTop = el.scrollHeight; }
function updRecord(rec) {
  if (!rec) return;
  for (let l = 0; l < 8; l++) { layers[l].act.set(rec.neurons[l]); layers[l].headAct.set(rec.heads[l]); }
  H.order.forEach((l, slot) => (layers[l].resid = rec.resid[slot]));
}
async function generate() {
  if (running) return; running = true; $('gen').disabled = true;
  const prompt = $('prompt').value, ids = tok.encode(prompt);
  const temp = +$('temp').value, N = +$('ntok').value, seed = +$('seed').value;
  const A = new Stream(W), B = new Stream(M); A.ids = ids.slice(); B.ids = ids.slice(); curB = B;
  const rA = mulberry32(seed), rB = mulberry32(seed);
  $('outA').innerHTML = ''; $('outB').innerHTML = ''; $('diverge').textContent = '';
  append($('outA'), prompt, 'p'); append($('outB'), prompt, 'p');
  let oA, oB; for (let i = 0; i < ids.length; i++) { oA = A.step(ids[i]); oB = B.step(ids[i], { ...H.runtime(), record: i === ids.length - 1 }); }
  updRecord(oB.rec); repaint();
  let doneA = false, doneB = false, div = -1; const t0 = performance.now(); let n = 0;
  for (let k = 0; k < N && running && !(doneA && doneB); k++) {
    let a = -1, b = -1;
    if (!doneA) { a = sample(A.logits(oA.hidden), temp, 50, rA); if (a === 50256) doneA = true; else { A.ids.push(a); append($('outA'), tok.tokenStr(a), 't'); oA = A.step(a); } }
    if (!doneB) { b = sample(B.logits(oB.hidden), temp, 50, rB); if (b === 50256) doneB = true; else { B.ids.push(b); const diff = A.ids[B.ids.length - 1] !== b; if (diff && div < 0) { div = k; $('diverge').textContent = `diverged @ token ${k}`; } append($('outB'), tok.tokenStr(b), diff ? 't diff' : 't'); oB = B.step(b, { ...H.runtime(), record: true }); updRecord(oB.rec); repaint(); firePulse(diff ? 0xff4fd8 : 0x4df3ff); $('tokhud').textContent = JSON.stringify(tok.tokenStr(b)); } }
    n++; $('speed').textContent = `${(n / ((performance.now() - t0) / 1000)).toFixed(1)} tok/s ×2 models`;
    if (sel) inspect();
    await new Promise((r) => setTimeout(r, 16));
  }
  if (div < 0) $('diverge').textContent = 'identical';
  running = false; $('gen').disabled = false;
}

// ───────────────────────── controls ─────────────────────────
function refreshLog() {
  const el = $('log'); const items = [];
  for (const e of H.edits) items.push(`<div>${esc(H.label(e)).replace(/·/g, ' ')}<span data-id="${e.id}">✕</span></div>`);
  for (const k of H.ablated) items.push(`<div>ablate L${(k / 16) | 0}·H${k % 16}<span data-ab="${k}">✕</span></div>`);
  if (H.steer.alpha) items.push(`<div>steer "${esc(H.steer.a)}"−"${esc(H.steer.b)}" @L${H.steer.layer} ×${H.steer.alpha}</div>`);
  if (H.chaos) items.push(`<div>chaos ${H.chaos}%</div>`);
  el.innerHTML = items.join('') || '<div class="empty">no edits — the model is pristine</div>';
  $('order').innerHTML = H.order.map((l, i) => `<span class="${l !== i ? 'sw' : ''}">${l}</span>`).join('');
  layers.forEach((L) => (L.targetY = H.order.indexOf(layers.indexOf(L)) * GAP));
  repaint(); if (sel) inspect();
}
$('log').addEventListener('click', (e) => { const id = e.target.dataset.id, ab = e.target.dataset.ab; if (id) H.remove(+id); if (ab) H.ablated.delete(+ab); refreshLog(); });
const bindV = (id, f = (v) => v) => { const u = () => ($(id + 'v').textContent = f($(id).value)); $(id).addEventListener('input', u); u(); };
bindV('temp'); bindV('ntok'); bindV('amt');
document.querySelectorAll('[data-op]').forEach((b) => b.addEventListener('click', () => {
  const type = $('tgtType').value, l = Math.max(0, Math.min(7, +$('tL').value)), i = Math.max(0, Math.min(type === 'head' ? 15 : 1023, +$('tI').value));
  const e = { type, l, i, op: b.dataset.op, amt: +$('amt').value };
  if (type === 'embed') { e.word = $('tTok').value; e.toks = tok.encode(e.word); }
  H.add(e); refreshLog(); flash(b);
}));
$('ablate').addEventListener('click', (ev) => { const l = +$('tL').value, h = Math.min(15, +$('tI').value), k = l * 16 + h; H.ablated.has(k) ? H.ablated.delete(k) : H.ablated.add(k); refreshLog(); flash(ev.target); });
function updSteer() { H.steer.a = $('stA').value; H.steer.b = $('stB').value; H.steer.layer = +$('stL').value; H.steer.alpha = +$('stS').value; $('stLv').textContent = H.steer.layer; $('stSv').textContent = H.steer.alpha; if (H.steer.alpha) H.computeSteer(); refreshLog(); }
['stA', 'stB', 'stL', 'stS'].forEach((id) => $(id).addEventListener('change', updSteer));
['stL', 'stS'].forEach((id) => $(id).addEventListener('input', () => { $('stLv').textContent = $('stL').value; $('stSv').textContent = $('stS').value; }));
$('swap').addEventListener('click', () => { const a = H.order.indexOf(+$('swA').value), b = H.order.indexOf(+$('swB').value); [H.order[a], H.order[b]] = [H.order[b], H.order[a]]; refreshLog(); });
$('shuffle').addEventListener('click', () => { for (let i = 7; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [H.order[i], H.order[j]] = [H.order[j], H.order[i]]; } refreshLog(); });
$('chaos').addEventListener('input', () => ($('chaosv').textContent = $('chaos').value + '%'));
$('chaos').addEventListener('change', () => { H.chaos = +$('chaos').value; H.rebuild(); refreshLog(); });
$('reset').addEventListener('click', () => { H.resetAll(); $('chaos').value = 0; $('chaosv').textContent = '0%'; $('stS').value = 0; $('stSv').textContent = '0'; refreshLog(); });
async function restart() { running = false; while ($('gen').disabled) await new Promise((r) => setTimeout(r, 30)); generate(); }
$('gen').addEventListener('click', restart);
$('stop').addEventListener('click', () => (running = false));
document.querySelectorAll('[data-preset]').forEach((b) => b.addEventListener('click', () => {
  H.resetAll(); PRESETS[b.dataset.preset](H);
  $('chaos').value = H.chaos; $('chaosv').textContent = H.chaos + '%'; $('stS').value = H.steer.alpha; $('stSv').textContent = H.steer.alpha;
  $('stA').value = H.steer.a; $('stB').value = H.steer.b; $('stL').value = H.steer.layer; $('stLv').textContent = H.steer.layer;
  refreshLog(); flash(b); restart();
}));
$('tgtType').addEventListener('change', () => { if ($('tgtType').value === 'embed') { sel = { kind: 'embed', l: 0 }; inspect(); } });
function flash(b) { b.animate([{ boxShadow: '0 0 24px #ff4fd8' }, { boxShadow: 'none' }], { duration: 600 }); }

// ───────────────────────── boot ─────────────────────────
try {
  const r = await loadModel(); W = r.W; tok = r.tok; M = cloneWeights(W); H = new Hacker(W, M, tok);
  window.NEURALESE = { W, M, H, tok, generate };
  setLoad(`loaded ${r.mb.toFixed(1)} MB · 19.7M params`, 1);
  $('loader').style.opacity = 0; setTimeout(() => $('loader').remove(), 900);
  refreshLog(); select({ kind: 'layer', l: 3 }); generate();
} catch (e) { setLoad('failed to load model: ' + e.message + ' — try reloading', 0); console.error(e); }
