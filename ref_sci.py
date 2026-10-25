import json, torch, numpy as np
from transformers import GPTNeoForCausalLM
m = GPTNeoForCausalLM.from_pretrained('roneneldan/TinyStories-8M', revision='refs/pr/1').eval()
E = m.transformer.wte.weight.detach().double(); G = E.T @ E; R = {'ov': {}, 'comp': {}}
def parts(l, h):
    a = m.transformer.h[l].attn.attention; s = slice(h*16, h*16+16)
    return [x.detach().double() for x in (a.q_proj.weight[s], a.k_proj.weight[s], a.v_proj.weight[s], a.out_proj.weight[:, s])]
for l, h in [(0, 0), (3, 5), (5, 11), (7, 2)]:
    Q, K, V, O = parts(l, h); ev = np.linalg.eigvals((V @ G @ O).numpy()); eq = np.linalg.eigvals((K @ G @ Q.T).numpy())
    R['ov'][f'{l}.{h}'] = [float(ev.real.sum() / np.abs(ev).sum()), float(eq.real.sum() / np.abs(eq).sum())]
fro = lambda x: float(torch.linalg.norm(x))
for (l1, h1, l2, h2) in [(0, 3, 1, 4), (2, 7, 5, 1), (4, 0, 7, 15)]:
    Q1, K1, V1, O1 = parts(l1, h1); Q2, K2, V2, O2 = parts(l2, h2); OV1 = O1 @ V1; QK2 = Q2.T @ K2; OV2 = O2 @ V2
    R['comp'][f'{l1}.{h1}-{l2}.{h2}'] = [fro(QK2.T @ OV1) / fro(QK2) / fro(OV1), fro(QK2 @ OV1) / fro(QK2) / fro(OV1), fro(OV2 @ OV1) / fro(OV2) / fro(OV1)]
W = m.transformer.h[7].mlp.c_fc.weight.detach().double(); S = torch.linalg.svdvals(W); s2 = S**2
R['spec'] = {'effRank': float(torch.exp(-(S/S.sum() * torch.log(S/S.sum())).sum())), 'stable': float(s2.sum()/s2[0]), 'cond': float(S[0]/S[-1])}
json.dump(R, open('ref_sci.json', 'w')); print(R)
