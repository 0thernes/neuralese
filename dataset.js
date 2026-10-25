// shared dataset: built-in TinyStories-style corpus, or a user-uploaded corpus used by every docs-based tool.
import { CORPUS } from './corpus.js?v=7';
export const DS = { user: null, name: 'built-in corpus (40 docs)' };
export const allDocs = () => DS.user || CORPUS;
export const docs = (n, T = 24) => { const a = allDocs(); return a.slice(0, Math.max(1, Math.min(a.length, n))).map((x) => x.slice(0, T)); };
export function setUserCorpus(tok, text, name = 'user corpus') { const parts = text.split(/\n\s*\n|\r\n\s*\r\n/).map((s) => s.trim()).filter((s) => s.length > 8);
  if (!parts.length) throw new Error('no documents found — separate documents with a blank line'); const d = parts.slice(0, 500).map((p) => tok.encode(p)).filter((x) => x.length >= 4);
  if (!d.length) throw new Error('every document tokenised to < 4 tokens'); DS.user = d; DS.name = `${name} (${d.length} docs)`; return d; }
export const clearUserCorpus = () => { DS.user = null; DS.name = 'built-in corpus (40 docs)'; };
