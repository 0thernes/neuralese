# PyTorch autograd reference for grad.js
import json, torch
from transformers import GPTNeoForCausalLM, GPT2TokenizerFast
m = GPTNeoForCausalLM.from_pretrained('roneneldan/TinyStories-8M', revision='refs/pr/1').eval().float()
tk = GPT2TokenizerFast.from_pretrained('roneneldan/TinyStories-8M')
P = 'Once upon a time, there was a little girl named Lily. She loved to'
ids = tk(P, return_tensors='pt').input_ids; R = {'ids': ids[0].tolist()}
out = m(ids, labels=ids); out.loss.backward(); R['loss'] = float(out.loss)
g = {}
for l in [0, 3, 7]:
    b = m.transformer.h[l]; a = b.attn.attention
    for k, p in [('q', a.q_proj.weight), ('k', a.k_proj.weight), ('v', a.v_proj.weight), ('o', a.out_proj.weight), ('ob', a.out_proj.bias), ('fc', b.mlp.c_fc.weight), ('fcb', b.mlp.c_fc.bias), ('proj', b.mlp.c_proj.weight), ('ln1w', b.ln_1.weight), ('ln2b', b.ln_2.bias)]:
        gr = p.grad.flatten(); g[f'{l}.{k}'] = {'norm': float(gr.norm()), 'head': gr[:8].tolist(), 'argmax': int(gr.abs().argmax()), 'max': float(gr[gr.abs().argmax()])}
R['wgrad'] = g; R['lnfW_norm'] = float(m.transformer.ln_f.weight.grad.norm()); R['wpe_head'] = m.transformer.wpe.weight.grad[0, :8].tolist()
m.zero_grad()
# input-embedding gradient of a logit difference at last position
e = (m.transformer.wte(ids) + m.transformer.wpe(torch.arange(ids.shape[1]))).detach().requires_grad_(True)
o2 = m(inputs_embeds=e - m.transformer.wpe(torch.arange(ids.shape[1])).detach())
A, B = tk.encode(' play')[0], tk.encode(' dance')[0]
met = o2.logits[0, -1, A] - o2.logits[0, -1, B]; met.backward()
R['ld'] = {'a': A, 'b': B, 'value': float(met), 'gxi': (e.grad * e).sum(-1)[0].tolist(), 'dx0_norm': e.grad.norm(dim=-1)[0].tolist()}
json.dump(R, open('ref_grad.json', 'w')); print(R['loss'], R['ld']['value'])
