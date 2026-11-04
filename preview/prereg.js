// v16 enforced pre-registration. A run is described by a JSON document that must validate against PREREG_SCHEMA, is hashed over a
// canonical (sorted-key) serialisation, and startRun() REFUSES to start unless (a) the document validates, (b) its sha256 equals the
// hash the researcher froze beforehand, and (c) its commit_sha equals the code commit actually running. Results are exported as a
// REPRO bundle {prereg, prereg_sha256, commit, weights_sha256, results, verdict, env, bundle_sha256} that verifyBundle() re-checks.
export const PREREG_SCHEMA = {
  $schema: 'https://json-schema.org/draft/2020-12/schema', $id: 'https://0thernes.github.io/neuralese/prereg.schema.json', title: 'Neuralese pre-registration', type: 'object',
  required: ['hypothesis', 'metric', 'null', 'threshold', 'seed', 'commit_sha'], additionalProperties: false,
  properties: {
    hypothesis: { type: 'string', minLength: 10 },
    metric: { type: 'object', required: ['name', 'params'], additionalProperties: false, properties: { name: { enum: ['head_ablation_delta_ce', 'mean_ce'] }, params: { type: 'object' } } },
    null: { type: 'string', minLength: 5 },
    threshold: { type: 'object', required: ['op', 'value'], additionalProperties: false, properties: { op: { enum: ['>', '>=', '<', '<='] }, value: { type: 'number' } } },
    seed: { type: 'integer', minimum: 0, maximum: 4294967295 },
    commit_sha: { type: 'string', pattern: '^[0-9a-f]{40}$' },
    author: { type: 'string' }, created: { type: 'string' }, notes: { type: 'string' },
  },
};
// minimal validator for exactly the keywords PREREG_SCHEMA uses (type, required, additionalProperties:false, enum, minLength, pattern, minimum, maximum)
export function validate(doc, S = PREREG_SCHEMA, path = '$') {
  const errs = [], ty = (v) => (Array.isArray(v) ? 'array' : v === null ? 'null' : Number.isInteger(v) ? 'integer' : typeof v);
  if (S.enum && !S.enum.includes(doc)) errs.push(`${path}: must be one of ${S.enum.join(', ')}`);
  if (S.type) { const t = ty(doc); if (!(t === S.type || (S.type === 'number' && t === 'integer'))) { errs.push(`${path}: expected ${S.type}, got ${t}`); return errs; } }
  if (typeof doc === 'string') { if (S.minLength && doc.length < S.minLength) errs.push(`${path}: shorter than ${S.minLength}`); if (S.pattern && !new RegExp(S.pattern).test(doc)) errs.push(`${path}: does not match ${S.pattern}`); }
  if (typeof doc === 'number') { if (S.minimum != null && doc < S.minimum) errs.push(`${path}: < ${S.minimum}`); if (S.maximum != null && doc > S.maximum) errs.push(`${path}: > ${S.maximum}`); if (!Number.isFinite(doc)) errs.push(`${path}: not finite`); }
  if (S.type === 'object') { for (const k of S.required || []) if (!(k in doc)) errs.push(`${path}.${k}: required`);
    for (const k of Object.keys(doc)) { if (S.properties && S.properties[k]) errs.push(...validate(doc[k], S.properties[k], `${path}.${k}`)); else if (S.additionalProperties === false) errs.push(`${path}.${k}: not allowed`); } }
  return errs;
}
export const canonical = (v) => (Array.isArray(v) ? '[' + v.map(canonical).join(',') + ']' : v && typeof v === 'object' ? '{' + Object.keys(v).sort().map((k) => JSON.stringify(k) + ':' + canonical(v[k])).join(',') + '}' : JSON.stringify(v));
export async function sha256Hex(s) { const b = await crypto.subtle.digest('SHA-256', typeof s === 'string' ? new TextEncoder().encode(s) : s); return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join(''); }
export const preregHash = (doc) => sha256Hex(canonical(doc));
export class PreregError extends Error {}
// Throws PreregError (the run never starts) on any mismatch; returns the frozen run context otherwise.
export async function startRun(doc, { expectedHash, commit }) {
  const errs = validate(doc); if (errs.length) throw new PreregError('pre-registration invalid: ' + errs.join('; '));
  const h = await preregHash(doc); if (!expectedHash || h !== String(expectedHash).toLowerCase()) throw new PreregError(`pre-registration hash mismatch: document hashes to ${h}, frozen hash is ${expectedHash || '(none)'}`);
  if (!commit || doc.commit_sha !== commit) throw new PreregError(`commit mismatch: pre-registered ${doc.commit_sha}, running ${commit || '(unknown)'}`);
  return Object.freeze({ prereg: JSON.parse(JSON.stringify(doc)), prereg_sha256: h, commit, started: new Date().toISOString() });
}
export function verdict(doc, value) { const { op, value: th } = doc.threshold, pass = op === '>' ? value > th : op === '>=' ? value >= th : op === '<' ? value < th : value <= th;
  return { value, threshold: `${op} ${th}`, hypothesis_supported: pass, text: pass ? `metric ${value} ${op} ${th}: null rejected at the pre-registered threshold` : `metric ${value} not ${op} ${th}: null not rejected` }; }
export async function reproBundle(run, { results, weights_sha256 = null, env = {} }) {
  const b = { kind: 'neuralese-repro-bundle', version: 1, prereg: run.prereg, prereg_sha256: run.prereg_sha256, commit: run.commit, started: run.started, finished: new Date().toISOString(), weights_sha256, env, results, verdict: verdict(run.prereg, results.metric) };
  b.bundle_sha256 = await sha256Hex(canonical(b)); return b;
}
export async function verifyBundle(b) { const { bundle_sha256, ...rest } = b, problems = [];
  if ((await sha256Hex(canonical(rest))) !== bundle_sha256) problems.push('bundle_sha256 does not match contents');
  if ((await preregHash(b.prereg)) !== b.prereg_sha256) problems.push('prereg_sha256 does not match the embedded pre-registration');
  if (b.prereg.commit_sha !== b.commit) problems.push('commit differs from the pre-registered commit');
  const v = verdict(b.prereg, b.results.metric); if (v.hypothesis_supported !== b.verdict.hypothesis_supported) problems.push('verdict inconsistent with metric and threshold');
  return { ok: !problems.length, problems }; }
// Metrics (pure functions of engine + tokens; seed fixes every random choice)
export function runMetric(doc, eng, ids) {
  const ce = (R) => { const old = eng.R; eng.R = R; try { const s = eng.newSeq(ids.length); let tot = 0; for (let t = 0; t < ids.length - 1; t++) { const l = eng.logits(eng.step(s, ids[t]).h); let mx = -Infinity; for (const v of l) if (v > mx) mx = v; let z = 0; for (const v of l) z += Math.exp(v - mx); tot += Math.log(z) + mx - l[ids[t + 1]]; } return tot / (ids.length - 1); } finally { eng.R = old; } };
  const base = JSON.parse(JSON.stringify(eng.R)); base.seed = doc.seed;
  if (doc.metric.name === 'mean_ce') return { metric: ce(base), n_tokens: ids.length };
  const { layer, head } = doc.metric.params; const ab = JSON.parse(JSON.stringify(base)); ab.headAbl[layer][head] = 'zero'; const c0 = ce(base), c1 = ce(ab);
  return { metric: c1 - c0, ce_clean: c0, ce_ablated: c1, n_tokens: ids.length };
}
