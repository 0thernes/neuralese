// Minimal GPT-2 byte-level BPE tokenizer (vocab.json + merges.txt)
import { frame } from './coop.js?v=170';
function bytesToUnicode() {
  const bs = [];
  for (let i = 33; i <= 126; i++) bs.push(i);
  for (let i = 161; i <= 172; i++) bs.push(i);
  for (let i = 174; i <= 255; i++) bs.push(i);
  const cs = bs.slice();
  let n = 0;
  for (let b = 0; b < 256; b++) if (!bs.includes(b)) { bs.push(b); cs.push(256 + n); n++; }
  const m = new Map();
  bs.forEach((b, i) => m.set(b, String.fromCharCode(cs[i])));
  return m;
}
const PAT = /'s|'t|'re|'ve|'m|'ll|'d| ?\p{L}+| ?\p{N}+| ?[^\s\p{L}\p{N}]+|\s+(?!\S)|\s+/gu;

export class GPT2Tokenizer {
  constructor(vocab, mergesText) {
    this.encoder = vocab;
    this.decoder = [];
    for (const [k, v] of Object.entries(vocab)) this.decoder[v] = k;
    this.ranks = new Map();
    const lines = mergesText.split('\n');
    let r = 0;
    for (const l of lines) {
      if (!l || l.startsWith('#version')) continue;
      this.ranks.set(l, r++);
    }
    this.b2u = bytesToUnicode();
    this.u2b = new Map([...this.b2u].map(([b, u]) => [u, b]));
    this.cache = new Map();
    this.te = new TextEncoder();
    this.td = new TextDecoder('utf-8', { fatal: false });
  }
  // Rank of a vocab-string pair. The shipped table is a sorted Uint32 key array, so the page never parses merges.txt.
  pairRank(left, right) {
    if (!this.pairKeys) return this.ranks.get(left + ' ' + right);
    const a = this.encoder[left], b = this.encoder[right];
    if (a == null || b == null) return undefined;
    const key = a * 65536 + b, keys = this.pairKeys;
    let lo = 0, hi = keys.length - 1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1, k = keys[mid];
      if (k === key) return this.pairRanks[mid];
      if (k < key) lo = mid + 1; else hi = mid - 1;
    }
    return undefined;
  }
  static fromPairs(vocab, buffer, deferDecoder = false) {
    const view = new DataView(buffer);
    const magic = String.fromCharCode(view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3));
    if (magic !== 'BPE1') throw new Error('bad bpe rank table');
    const n = view.getUint32(4, true);
    const tok = new GPT2Tokenizer({}, '');
    tok.encoder = vocab;
    if (!deferDecoder) { tok.decoder = []; for (const [k, v] of Object.entries(vocab)) tok.decoder[v] = k; }
    tok.pairKeys = new Uint32Array(buffer, 8, n);
    tok.pairRanks = new Uint16Array(buffer, 8 + n * 4, n);
    return tok;
  }
  // The 50k-entry vocab walk is split. The sync constructor stays for tests and small vocabs.
  static async create(vocab, mergesText) {
    const tok = new GPT2Tokenizer({}, '');
    tok.encoder = vocab;
    tok.decoder = [];
    const keys = Object.keys(vocab);
    for (let i = 0; i < keys.length; i++) {
      tok.decoder[vocab[keys[i]]] = keys[i];
      if ((i & 63) === 63 && typeof document !== 'undefined') await frame();
    }
    tok.ranks = new Map();
    const lines = String(mergesText).split('\n');
    let r = 0;
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      if (l && !l.startsWith('#version')) tok.ranks.set(l, r++);
      if ((i & 7) === 7 && typeof document !== 'undefined') await frame();
    }
    return tok;
  }
  // Page path. The rank table is the precomputed binary; only the vocab strings are copied, and that copy yields.
  static async createFromPairs(vocab, buffer) {
    const tok = GPT2Tokenizer.fromPairs(vocab, buffer, true);
    tok.decoder = [];
    const keys = Object.keys(vocab);
    for (let i = 0; i < keys.length; i++) {
      tok.decoder[vocab[keys[i]]] = keys[i];
      if ((i & 511) === 511 && typeof document !== 'undefined') await frame();
    }
    return tok;
  }
  bpe(token) {
    if (this.cache.has(token)) return this.cache.get(token);
    let word = Array.from(token);
    while (word.length > 1) {
      let best = null, bestRank = Infinity;
      for (let i = 0; i < word.length - 1; i++) {
        const r = this.pairRank(word[i], word[i + 1]);
        if (r !== undefined && r < bestRank) { bestRank = r; best = i; }
      }
      if (best === null) break;
      const a = word[best], b = word[best + 1];
      const nw = [];
      for (let i = 0; i < word.length; i++) {
        if (i < word.length - 1 && word[i] === a && word[i + 1] === b) { nw.push(a + b); i++; }
        else nw.push(word[i]);
      }
      word = nw;
    }
    this.cache.set(token, word);
    return word;
  }
  encode(text) {
    const ids = [];
    for (const m of text.matchAll(PAT)) {
      const s = Array.from(this.te.encode(m[0]), (b) => this.b2u.get(b)).join('');
      for (const t of this.bpe(s)) ids.push(this.encoder[t]);
    }
    return ids;
  }
  decode(ids) {
    const bytes = [];
    for (const id of ids) for (const ch of this.decoder[id] || '') bytes.push(this.u2b.get(ch));
    return this.td.decode(new Uint8Array(bytes));
  }
  tokenStr(id) { return this.decode([id]); }
}
