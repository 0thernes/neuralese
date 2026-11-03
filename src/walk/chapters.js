// Original narration for the deep walk. The idea of stepping through a transformer as blocks
// of numbers is inspired by Brendan Bycroft's LLM Visualization (https://bbycroft.net/llm).
// The sentences, the order, and the pictures are not taken from that site.

export const CHAPTERS = Object.freeze([
  { id: 'embed', title: 'Embedding', text: 'The token id selects a row of the token table. The position selects a row of the position table. This block is the sum, one float per residual channel.' },
  { id: 'norm', title: 'Layer norm', text: 'Layer norm recenters the residual and rescales it. A hovered channel is (x − mean) × rstd × weight + bias, using the mean and rstd of this vector.' },
  { id: 'qkv', title: 'Q, K, V', text: 'Three matrices read the normalized vector and write a query, a key, and a value. Each is split across the heads. The engine accumulates each output in four lanes, then adds them.' },
  { id: 'score', title: 'Attention scores', text: 'Inside the selected head, the score against an earlier key is the dot product of that head’s query slice with that key slice, divided by the head temperature. Masked positions stay out of the softmax.' },
  { id: 'softmax', title: 'Softmax', text: 'Scores become weights: subtract the max, exponentiate, divide by the sum. The weights along this row add to one, apart from positions the mask removed.' },
  { id: 'mix', title: 'Value mix', text: 'Each weight scales a value vector. The head’s slice of z is that weighted sum. A head ablation in the runtime, if one is set, has already replaced this slice.' },
  { id: 'proj', title: 'Projection and residual', text: 'The output matrix mixes the heads back to the residual width and adds its bias. The residual then adds that vector, channel by channel.' },
  { id: 'mlp', title: 'MLP', text: 'A second layer norm feeds the wider MLP. GELU is applied elementwise, the projection returns to the residual width, and that vector is added back.' },
  { id: 'logits', title: 'Logits', text: 'A final layer norm, then a dot product with every token row. The largest logit is the greedy next token. The grid shows the largest logits and says how many it left out.' },
  { id: 'float', title: 'One product', text: 'One multiply from the selected dot product. The two factors are float32. The engine adds the product into a JavaScript number, which is a float64 accumulator, not a float32 FMA.' },
  { id: 'gates', title: 'Gates', text: 'AND, OR, XOR, and NOT, simulated as a unit-delay netlist. A Forge instruction lowers to the ALU that implements it. A normal float term lowers to the integer multiply of its significands. The engine did not clock this netlist.' },
  { id: 'voltage', title: 'Voltage', text: 'A simulated square-law CMOS inverter and NAND2. The sliders move that model. They do not change the supply of the CPU or GPU running Neuralese.' },
]);

export function chapterById(id) {
  return CHAPTERS.find((c) => c.id === id) || CHAPTERS[0];
}

export function chapterOf(op) {
  if (!op) return 'embed';
  if (op.id === 'logits' || op.weight === 'lnf' || op.id === 'final' || op.id === 'lnf') return 'logits';
  if (op.id.startsWith('embed')) return 'embed';
  if (op.weight === 'ln1w' || String(op.id).endsWith('.ln1')) return 'norm';
  if (op.weight === 'q' || op.weight === 'k' || op.weight === 'v') return 'qkv';
  if (op.kind === 'score') return 'score';
  if (op.kind === 'softmax') return 'softmax';
  if (op.kind === 'mix') return 'mix';
  if (op.weight === 'o' || String(op.id).endsWith('resid_attn')) return 'proj';
  if (op.weight === 'ln2w' || op.weight === 'fc' || op.kind === 'gelu' || op.weight === 'proj' || String(op.id).endsWith('resid_mlp')) return 'mlp';
  return 'stream';
}

export function titleOf(op) {
  if (op.id === 'embed') return 'Token + position';
  if (op.id === 'embed.wte') return 'Token row';
  if (op.id === 'embed.wpe') return 'Position row';
  if (op.id === 'logits') return 'Logits';
  if (op.id === 'lnf') return 'Final layer norm';
  if (op.id === 'final') return 'Final residual';
  const head = op.head == null ? '' : ` head ${op.head}`;
  const layer = op.layer == null ? '' : `L${op.layer} `;
  if (op.kind === 'score') return `${layer}scores${head}`;
  if (op.kind === 'softmax') return `${layer}softmax${head}`;
  if (op.kind === 'mix') return `${layer}mixed values`;
  if (op.kind === 'ln') return `${layer}layer norm`;
  if (op.kind === 'gelu') return `${layer}GELU`;
  if (op.kind === 'residual') return `${layer}residual add`;
  if (op.weight === 'q') return `${layer}queries`;
  if (op.weight === 'k') return `${layer}keys`;
  if (op.weight === 'v') return `${layer}values`;
  if (op.weight === 'o') return `${layer}attention projection`;
  if (op.weight === 'fc') return `${layer}MLP up-projection`;
  if (op.weight === 'proj') return `${layer}MLP down-projection`;
  if (String(op.id).endsWith('resid_pre')) return `${layer}residual in`;
  if (String(op.id).endsWith('resid_post')) return `${layer}residual out`;
  return op.id;
}
