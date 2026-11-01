// Minimal GPT-2 byte-level BPE tokenizer (vocab.json + merges.txt)
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
  bpe(token) {
    if (this.cache.has(token)) return this.cache.get(token);
    let word = Array.from(token);
    while (word.length > 1) {
      let best = null, bestRank = Infinity;
      for (let i = 0; i < word.length - 1; i++) {
        const r = this.ranks.get(word[i] + ' ' + word[i + 1]);
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
