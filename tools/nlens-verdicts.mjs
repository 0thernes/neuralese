// Applies the frozen predictions P1–P5 of docs/PREREG-v14.md to validation.json (point estimates, as the prereg defines "supported").
// Usage: node tools/nlens-verdicts.mjs [lens/ts8m/validation.json]   (writes .verdicts back into the same file)
import fs from 'node:fs';
export function verdicts(v) {
  const A = (l, k) => v.testA.find((r) => r.layer === l && r.lens === k), B = (l, k) => v.testB.find((r) => r.layer === l && r.lens === k);
  const maj = (ls, f) => { const ok = ls.filter(f); return [ok.length > ls.length / 2, `${ok.length}/${ls.length} layers (${ok.join(',') || 'none'})`]; };
  const r = (a, b) => [...Array(b - a + 1).keys()].map((i) => i + a), out = {};
  let [p, d] = maj(r(0, 6), (l) => A(l, 'R.out') && A(l, 'logit') && A(l, 'R.out').medianR > A(l, 'logit').medianR); out.P1 = { pass: p, detail: `R.out median r > logit lens at ${d}` };
  [p, d] = maj(r(1, 6), (l) => A(l, 'R.out') && A(l, 'R.out').top10Rise >= 0.9); out.P2 = { pass: p, detail: `R.out top-10 rise ≥ 0.90 at ${d}` };
  const s = (l) => B(l, 'S.mid')?.medianRho, R = (l) => B(l, 'R.mid')?.medianRho;
  out.P3 = { pass: s(0) > R(0) && s(1) > R(1) && R(7) > s(7), detail: `ρ S.mid vs R.mid: L0 ${s(0)} vs ${R(0)}, L1 ${s(1)} vs ${R(1)}, L7 ${s(7)} vs ${R(7)}` };
  const [p4a, d4a] = maj(r(1, 7), (l) => B(l, 'S.mid')?.medianRho > B(l, 'S.out[L-1]')?.medianRho), [p4b, d4b] = maj(r(1, 7), (l) => B(l, 'R.mid')?.medianRho > B(l, 'R.out[L-1]')?.medianRho);
  out.P4 = { pass: p4a && p4b, detail: `S.mid > S.out[L−1] at ${d4a}; R.mid > R.out[L−1] at ${d4b}` };
  const real = [...new Set([...v.testA, ...v.testB].map((x) => x.lens))].filter((k) => /^[RS]\./.test(k)), fails = [];
  for (const k of real) { const rows = [...v.testA, ...v.testB].filter((x) => x.lens === k), ok = rows.filter((x) => x.passCI[0] > 0.01).length; if (!(ok > rows.length / 2)) fails.push(`${k} (${ok}/${rows.length})`); }
  out.P5 = { pass: !fails.length, detail: fails.length ? `fails for ${fails.join(', ')}` : `all of ${real.join(', ')} have pass-rate CI lower bound > 0.01 at a majority of layers` };
  return out;
}
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop())) {
  const f = process.argv[2] || 'lens/ts8m/validation.json', v = JSON.parse(fs.readFileSync(f, 'utf8')); v.verdicts = verdicts(v); fs.writeFileSync(f, JSON.stringify(v, null, 1));
  for (const [k, x] of Object.entries(v.verdicts)) console.log(k, x.pass ? 'SUPPORTED' : 'NOT SUPPORTED', '—', x.detail);
}
