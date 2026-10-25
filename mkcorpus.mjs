import fs from 'fs';
import { GPT2Tokenizer } from './tokenizer.js';
import { buildWeights, parseSafetensors, Stream, sample, mulberry32 } from './model.js';
const buf = fs.readFileSync('model/model.safetensors'); const n = Number(buf.readBigUInt64LE(0)); const hdr = JSON.parse(buf.subarray(8, 8 + n).toString());
const W = buildWeights(parseSafetensors(buf.buffer.slice(buf.byteOffset + 8 + n), n, hdr));
const tok = new GPT2Tokenizer(JSON.parse(fs.readFileSync('model/vocab.json')), fs.readFileSync('model/merges.txt', 'utf8'));
const starts = ['Once upon a time', 'One day, a little boy named Tim', 'Lily and her mom went to the', 'There was a big red ball', 'The cat was very hungry', 'Sam had a toy car', 'In a small town, there lived a', 'The sun was shining and', 'Ben wanted to play with', 'Sue found a shiny rock', 'A little bird sat on a tree', 'The dog barked at the', 'Mia loved to paint', 'It was a rainy day', 'Max and his dad went fishing', 'The princess lived in a castle', 'Tom was sad because', 'Anna saw a big bear', 'The kids played in the park', 'A fish swam in the', 'Grandma baked a cake', 'The car was fast and', 'Jack climbed the tall tree', 'Emma had a pretty dress', 'The frog jumped into the pond', 'Once there was a happy cow', 'Bob lost his blue hat', 'The moon was bright', 'Lucy and Ben were friends', 'A dragon flew over the hill', 'The teacher said to the class', 'Sara was scared of the dark', 'The bunny hopped in the garden', 'Joe wanted a new bike', 'The boat sailed on the sea', 'Kate found a little kitten', 'The old man had a garden', 'Zoe went to the zoo', 'The snow was cold and white', 'Leo was a brave lion'];
const rng = mulberry32(7); const docs = [];
for (const st of starts) {
  const ids = tok.encode(st); const s = new Stream(W); let o; for (const i of ids) o = s.step(i);
  for (let k = 0; k < 64; k++) { const nx = sample(s.logits(o.hidden), 0.8, 40, rng); if (nx === 50256) break; ids.push(nx); o = s.step(nx); }
  docs.push(ids);
}
const total = docs.reduce((a, b) => a + b.length, 0);
fs.writeFileSync('corpus.js', `// Reference corpus: ${docs.length} stories sampled from clean TinyStories-8M (T=0.8, top-k 40, seed 7), ${total} tokens.\nexport const CORPUS = ${JSON.stringify(docs)};\n`);
console.log(total); console.log(tok.decode(docs[0]));
