// Teaching CMOS model. Square-law Shichman–Hodges (the SPICE level-1 MOSFET), matched
// pull-up and pull-down, long channel, no subthreshold leakage, no velocity saturation.
// Sakurai's alpha-power law is the short-channel correction this file does not apply.
// Nothing here changes the supply of the machine running Neuralese.

import { mulberry32, gauss } from '../model.js';

export const CMOS_MODEL = Object.freeze({
  id: 'shichman-hodges-level1-matched',
  name: 'Square-law Shichman–Hodges (SPICE level-1), matched CMOS, long-channel, no leakage',
  notSilicon: 'Simulated circuit. Not a foundry deck, and not the voltage of the CPU or GPU running this page.',
});

export const CMOS_BANNER = 'Simulated circuit. ' + CMOS_MODEL.name + '. ' + CMOS_MODEL.notSilicon;

// A valid high is at least 70% of VDD. A valid low is at most 30% of VDD.
// Those fractions are the logic thresholds used by every test and by the panel.
export const LOGIC = Object.freeze({ highFrac: 0.7, lowFrac: 0.3 });

export function cmosParams(over = {}) {
  return {
    VDD: 1,
    Vth0: 0.25,
    T: 300,
    T0: 300,
    dVth: -0.001,
    kn0: 2.0e-4,
    kp0: 2.0e-4,
    lambda: 0.02,
    Cload: 5e-15,
    ...over,
  };
}

export function vthAt(p) {
  const v = p.Vth0 + p.dVth * (p.T - p.T0);
  return { n: v, p: v };
}

export function driveAt(p) {
  const scale = (p.T / p.T0) ** -1.5;
  return { n: p.kn0 * scale, p: p.kp0 * scale };
}

// Id >= 0. Cutoff when Vgs <= Vth or Vds <= 0. Vds is the drain-source drop of that device.
export function idSquare(Vgs, Vds, k, Vth, lambda) {
  if (!(Vgs > Vth) || !(Vds > 0) || !(k > 0)) return 0;
  const vov = Vgs - Vth;
  const lam = 1 + lambda * Vds;
  if (Vds >= vov) return 0.5 * k * vov * vov * lam;
  return k * ((vov * Vds) - 0.5 * Vds * Vds) * lam;
}

function rails(p) {
  const th = vthAt(p);
  const k = driveAt(p);
  return { th, k };
}

export function solveInverter(p, Vin) {
  const { th, k } = rails(p);
  const nOn = Vin > th.n;
  const pOn = (p.VDD - Vin) > th.p;
  if (!nOn && !pOn) return { defined: false, vout: null, reason: 'both devices cutoff' };
  if (nOn && !pOn) return { defined: true, vout: 0, reason: 'NMOS pull-down, PMOS off' };
  if (!nOn && pOn) return { defined: true, vout: p.VDD, reason: 'PMOS pull-up, NMOS off' };
  let lo = 0;
  let hi = p.VDD;
  for (let i = 0; i < 60; i++) {
    const mid = 0.5 * (lo + hi);
    const idn = idSquare(Vin, mid, k.n, th.n, p.lambda);
    const idp = idSquare(p.VDD - Vin, p.VDD - mid, k.p, th.p, p.lambda);
    if (idn > idp) hi = mid;
    else lo = mid;
  }
  return { defined: true, vout: 0.5 * (lo + hi), reason: 'both devices conducting' };
}

function seriesNandCurrent(p, A, B, Vout, th, k) {
  if (!(Vout > 0)) return 0;
  let lo = 0;
  let hi = Vout;
  for (let i = 0; i < 48; i++) {
    const vx = 0.5 * (lo + hi);
    const ib = idSquare(B, vx, k.n, th.n, p.lambda);
    const ia = idSquare(A - vx, Vout - vx, k.n, th.n, p.lambda);
    if (ib > ia) hi = vx;
    else lo = vx;
  }
  const vx = 0.5 * (lo + hi);
  return idSquare(B, vx, k.n, th.n, p.lambda);
}

// CMOS NAND2. A and B are gate voltages. Series NMOS (B at the bottom), parallel PMOS.
export function solveNand(p, A, B) {
  const { th, k } = rails(p);
  const nA = A > th.n;
  const nB = B > th.n;
  const pA = (p.VDD - A) > th.p;
  const pB = (p.VDD - B) > th.p;
  if (!nA || !nB) {
    if (pA || pB) return { defined: true, vout: p.VDD, reason: 'NMOS stack off, a PMOS is on' };
    return { defined: false, vout: null, reason: 'no conducting path' };
  }
  if (!pA && !pB) return { defined: true, vout: 0, reason: 'PMOS off, NMOS stack on' };
  let lo = 0;
  let hi = p.VDD;
  for (let i = 0; i < 56; i++) {
    const mid = 0.5 * (lo + hi);
    const is = seriesNandCurrent(p, A, B, mid, th, k);
    const ip = idSquare(p.VDD - A, p.VDD - mid, k.p, th.p, p.lambda) + idSquare(p.VDD - B, p.VDD - mid, k.p, th.p, p.lambda);
    if (is > ip) hi = mid;
    else lo = mid;
  }
  return { defined: true, vout: 0.5 * (lo + hi), reason: 'ratioed NAND' };
}

export function logicOf(vout, VDD) {
  if (vout == null || !Number.isFinite(vout)) return 'invalid';
  if (vout >= LOGIC.highFrac * VDD) return 1;
  if (vout <= LOGIC.lowFrac * VDD) return 0;
  return 'invalid';
}

export function transferCurve(p, steps = 81) {
  const pts = [];
  const n = Math.max(2, steps);
  for (let i = 0; i < n; i++) {
    const vin = p.VDD * (i / (n - 1));
    const s = solveInverter(p, vin);
    pts.push({ vin, vout: s.vout, defined: s.defined });
  }
  return pts;
}

function unityGain(pts) {
  let vil = null;
  let vih = null;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    if (a.vout == null || b.vout == null) continue;
    const slope = (b.vout - a.vout) / (b.vin - a.vin);
    const mid = 0.5 * (a.vin + b.vin);
    if (vil == null && slope <= -1 && mid <= 0.5 * pts[pts.length - 1].vin) vil = mid;
    if (slope <= -1) vih = mid;
  }
  return { vil, vih };
}

// tp ≈ Cload · VDD / Idsat, a full-swing estimate. Not a 50% Elmore delay and not a silicon measurement.
export function stageDelay(p) {
  const { th, k } = rails(p);
  const idn = idSquare(p.VDD, p.VDD, k.n, th.n, p.lambda);
  const idp = idSquare(p.VDD, p.VDD, k.p, th.p, p.lambda);
  return {
    fall_s: idn > 0 ? p.Cload * p.VDD / idn : null,
    rise_s: idp > 0 ? p.Cload * p.VDD / idp : null,
    idn, idp,
    note: 'Cload·VDD/Idsat full-swing estimate. Not a measured 50% delay.',
  };
}

export function assessInverter(p, opts = {}) {
  const steps = opts.steps || 81;
  const curve = transferCurve(p, steps);
  const low = solveInverter(p, p.VDD);
  const high = solveInverter(p, 0);
  const vol = low.vout;
  const voh = high.vout;
  const { vil, vih } = unityGain(curve);
  const validLow = logicOf(vol, p.VDD) === 0;
  const validHigh = logicOf(voh, p.VDD) === 1;
  const nml = vil == null || vol == null ? null : vil - vol;
  const nmh = vih == null || voh == null ? null : voh - vih;
  const delay = stageDelay(p);
  let noiseErrors = 0;
  let noiseDraws = 0;
  if (opts.noiseSigma > 0 && opts.noiseDraws > 0) {
    const rng = mulberry32(opts.seed >>> 0);
    noiseDraws = opts.noiseDraws | 0;
    for (let i = 0; i < noiseDraws; i++) {
      const vin = Math.min(p.VDD, Math.max(0, p.VDD + gauss(rng) * opts.noiseSigma));
      const s = solveInverter(p, vin);
      const y = logicOf(s.vout, p.VDD);
      if (y !== 0) noiseErrors++;
    }
  }
  const failed = !validLow || !validHigh;
  return {
    model: CMOS_MODEL.id,
    banner: CMOS_BANNER,
    curve, vol, voh, vil, vih, nml, nmh, validLow, validHigh, failed,
    delay,
    noiseErrors, noiseDraws,
    reason: failed ? (low.reason || high.reason || 'output left the valid logic range') : 'valid logic at these parameters',
  };
}

export function nandTruth(p) {
  const V = p.VDD;
  const rows = [
    [0, 0, 1],
    [0, V, 1],
    [V, 0, 1],
    [V, V, 0],
  ];
  return rows.map(([a, b, expect]) => {
    const s = solveNand(p, a, b);
    const y = logicOf(s.vout, V);
    return { a, b, expect, vout: s.vout, y, defined: s.defined, ok: y === expect };
  });
}
