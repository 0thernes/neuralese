// Adversary Lab pre-registration. Separate from src/prereg.js, whose schema rejects extra fields.
// A locked document is deep-frozen. Changing it throws. revise() returns a new version.
import { canonical, sha256Hex } from '../prereg.js?v=170';

export class PreregLockError extends Error {}

const OMIT = new Set(['sha256', 'locked', 'locked_at']);

export function preregBody(doc) {
  const o = {};
  for (const k of Object.keys(doc)) if (!OMIT.has(k)) o[k] = doc[k];
  return o;
}

function isHex64(s) { return typeof s === 'string' && /^[0-9a-f]{64}$/.test(s); }

export function validateSpec(doc) {
  const e = [];
  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) return ['document must be an object'];
  if (typeof doc.hypothesis !== 'string' || doc.hypothesis.length < 10) e.push('hypothesis');
  if (!Array.isArray(doc.models) || !doc.models.length || doc.models.some((m) => typeof m !== 'string')) e.push('models');
  if (!isHex64(doc.prompt_set_sha256)) e.push('prompt_set_sha256');
  if (!Array.isArray(doc.feature_set) || doc.feature_set.some((x) => typeof x !== 'string')) e.push('feature_set');
  if (!Array.isArray(doc.fwl_covariates) || doc.fwl_covariates.some((x) => typeof x !== 'string')) e.push('fwl_covariates');
  if (!doc.success || typeof doc.success !== 'object') e.push('success');
  else {
    if (!(doc.success.delta_permutation_p_lt > 0 && doc.success.delta_permutation_p_lt < 1)) e.push('success.delta_permutation_p_lt');
    if (!(doc.success.encoding_permutation_p_gt > 0 && doc.success.encoding_permutation_p_gt < 1)) e.push('success.encoding_permutation_p_gt');
    if (typeof doc.success.neuron_rule !== 'string' || doc.success.neuron_rule.length < 10) e.push('success.neuron_rule');
  }
  if (!doc.seeds || !Number.isInteger(doc.seeds.detector) || !Number.isInteger(doc.seeds.permutation) || !Number.isInteger(doc.seeds.neurons)) e.push('seeds');
  if (!Number.isInteger(doc.n_permutations) || doc.n_permutations < 1) e.push('n_permutations');
  if (!Number.isInteger(doc.version) || doc.version < 1) e.push('version');
  if (doc.parent_sha256 != null && !isHex64(doc.parent_sha256)) e.push('parent_sha256');
  return e;
}

function deepFreeze(o) {
  if (o && typeof o === 'object' && !Object.isFrozen(o)) {
    for (const v of Object.values(o)) deepFreeze(v);
    Object.freeze(o);
  }
  return o;
}

export async function lockPrereg(doc) {
  const body = preregBody(doc);
  if (body.version == null) body.version = 1;
  const errs = validateSpec(body);
  if (errs.length) throw new PreregLockError('pre-registration invalid: ' + errs.join(', '));
  const sha256 = await sha256Hex(canonical(body));
  return deepFreeze({ ...body, sha256, locked: true, locked_at: new Date().toISOString() });
}

export function assertUnlocked(doc) {
  if (doc && doc.locked) throw new PreregLockError(`prereg is locked (${doc.sha256}). revise() creates version ${(doc.version || 1) + 1}`);
}

// Refuses in-place edits. Returns a new locked version whose parent is the previous hash.
export async function revisePrereg(locked, patch) {
  if (!locked?.locked) throw new PreregLockError('revise() expects a locked pre-registration');
  const body = { ...preregBody(locked), ...patch };
  body.version = (locked.version || 1) + 1;
  body.parent_sha256 = locked.sha256;
  return lockPrereg(body);
}

function scientificBody(doc) {
  const b = preregBody(doc);
  delete b.version;
  delete b.parent_sha256;
  return b;
}
// Ignores version and parent hash so an unchanged plan keeps its lock.
export async function sameBody(a, b) {
  return (await sha256Hex(canonical(scientificBody(a)))) === (await sha256Hex(canonical(scientificBody(b))));
}

function yamlScalar(v) {
  if (v == null) return 'null';
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  const s = String(v);
  if (s === '' || /[:#\n[\],{}]/.test(s) || /^\s|\s$/.test(s) || /^(true|false|null|-?\d+(\.\d+)?)$/.test(s)) return JSON.stringify(s);
  return s;
}

export function toYAML(v, indent = 0) {
  const pad = '  '.repeat(indent);
  if (Array.isArray(v)) {
    if (!v.length) return '[]';
    return v.map((item) => {
      if (item && typeof item === 'object') return pad + '- ' + toYAML(item, indent + 1).trimStart();
      return pad + '- ' + yamlScalar(item);
    }).join('\n');
  }
  if (v && typeof v === 'object') {
    return Object.keys(v).map((k) => {
      const val = v[k];
      if (val && typeof val === 'object') {
        const inner = toYAML(val, indent + 1);
        return pad + k + ':\n' + inner;
      }
      return pad + k + ': ' + yamlScalar(val);
    }).join('\n');
  }
  return pad + yamlScalar(v);
}

function parseScalar(s) {
  if (s === 'null') return null;
  if (s === 'true') return true;
  if (s === 'false') return false;
  if (/^-?\d+$/.test(s)) return Number(s);
  if (/^-?\d+\.\d+$/.test(s)) return Number(s);
  if (s.startsWith('"')) return JSON.parse(s);
  return s;
}

// Restricted YAML: maps, nested maps, and lists of scalars. Enough for a prereg file.
export function parseYAML(text) {
  const lines = text.split(/\r?\n/).map((raw) => {
    const line = raw.replace(/\t/g, '  ');
    if (!line.trim() || /^\s*#/.test(line)) return null;
    return { indent: line.match(/^ */)[0].length, text: line.trim() };
  }).filter(Boolean);
  let i = 0;
  function parseBlock(level) {
    if (i >= lines.length || lines[i].indent < level) return null;
    if (lines[i].text.startsWith('- ') && lines[i].indent === level) {
      const arr = [];
      while (i < lines.length && lines[i].indent === level && lines[i].text.startsWith('- ')) {
        arr.push(parseScalar(lines[i].text.slice(2).trim()));
        i++;
      }
      return arr;
    }
    const obj = {};
    while (i < lines.length && lines[i].indent === level && !lines[i].text.startsWith('- ')) {
      const m = lines[i].text.match(/^([^:]+):(.*)$/);
      if (!m) throw new Error('bad yaml: ' + lines[i].text);
      const key = m[1].trim(), rest = m[2].trim(), ind = lines[i].indent;
      i++;
      obj[key] = rest === '' ? parseBlock(ind + 2) : parseScalar(rest);
    }
    return obj;
  }
  if (!lines.length) throw new Error('empty yaml');
  return parseBlock(lines[0].indent);
}

export function parseSpec(text) {
  const t = String(text).trim();
  if (!t) throw new Error('empty pre-registration');
  return t.startsWith('{') ? JSON.parse(t) : parseYAML(t);
}

export async function reproBundle(prereg, results) {
  const b = {
    kind: 'neuralese-adversary-repro',
    version: 1,
    prereg: preregBody(prereg),
    prereg_sha256: prereg.sha256,
    results,
  };
  b.bundle_sha256 = await sha256Hex(canonical(b));
  return b;
}

export async function verifyAdversaryBundle(b) {
  const { bundle_sha256, notebook_markdown: _md, ...rest } = b;
  const problems = [];
  if ((await sha256Hex(canonical(rest))) !== bundle_sha256) problems.push('bundle_sha256 does not match contents');
  if ((await sha256Hex(canonical(preregBody(b.prereg)))) !== b.prereg_sha256) problems.push('prereg_sha256 does not match the embedded pre-registration');
  return { ok: problems.length === 0, problems };
}

export function notebookMarkdown(bundle) {
  const g = bundle.results?.geometry;
  const n = bundle.results?.neurons;
  const lines = [
    '## Adversary Lab',
    '',
    'Experimental key-cache geometry and MLP-unit comparison. Not a detector product.',
    '',
    `- Pre-registration \`${bundle.prereg_sha256}\``,
    `- Bundle \`${bundle.bundle_sha256}\``,
    g ? `- Geometry verdict: **${g.verdict.label}**. In-sample delta AUROC ${fmt(g.detector.delta.auroc)} (permutation p ${fmt(g.detector.delta.p)}). Encoding AUROC ${fmt(g.detector.encoding.auroc)} (p ${fmt(g.detector.encoding.p)}).` : '- Geometry was not run.',
    n ? `- Neuron rule: **${n.verdict.pass ? 'pass' : 'fail'}**. Steered evil+coherent ${n.verdict.candidateCount} of ${n.verdict.n}; random counts ${n.verdict.randomCounts.join(', ') || 'none'}.` : '- Neuron hunt was not run.',
    '',
    '### Caveats',
    ...(bundle.results?.caveats || []).map((c) => '- ' + c),
  ];
  return lines.join('\n');
}

function fmt(x) { return typeof x === 'number' && Number.isFinite(x) ? x.toFixed(3) : String(x); }
