# PyTorch reference for the Taylor-jet (Eshkol-style) cross-check in site/tsotchke/taylor.js.
# g(eps) = mean next-token CE of TinyStories-8M with final-LN weight lnf.w + eps*v, v_i = sin(i+1)/16.
import json, math, torch
from transformers import GPTNeoForCausalLM, GPT2TokenizerFast
torch.set_default_dtype(torch.float64)
m = GPTNeoForCausalLM.from_pretrained('roneneldan/TinyStories-8M', revision='refs/pr/1').eval().double()
tk = GPT2TokenizerFast.from_pretrained('roneneldan/TinyStories-8M')
P = 'Once upon a time, there was a little girl named Lily. She loved to'
ids = tk(P, return_tensors='pt').input_ids
with torch.no_grad(): h = m.transformer(ids).last_hidden_state  # already includes ln_f; recompute pre-LN below
out = m.transformer(ids, output_hidden_states=True); x = out.hidden_states[-1]  # GPT-Neo: last hidden state is post ln_f
# rebuild pre-ln_f residual: hidden_states[-1] is after ln_f in HF GPT-Neo; take the input to ln_f via a hook instead
pre = {}
hk = m.transformer.ln_f.register_forward_hook(lambda mod, i, o: pre.__setitem__('x', i[0].detach()))
with torch.no_grad(): m.transformer(ids)
hk.remove(); X = pre['x'][0]
w0, b0, E = m.transformer.ln_f.weight.detach(), m.transformer.ln_f.bias.detach(), m.transformer.wte.weight.detach()
v = torch.tensor([math.sin(i + 1) / 16 for i in range(256)])
eps = torch.zeros((), requires_grad=True)
def g(e):
    mu = X.mean(-1, keepdim=True); var = X.var(-1, unbiased=False, keepdim=True)
    y = (X - mu) / torch.sqrt(var + 1e-5) * (w0 + e * v) + b0
    lp = torch.log_softmax(y @ E.T, -1)
    t = ids[0, 1:]
    return -lp[:-1].gather(1, t[:, None]).mean()
val = g(eps); d1, = torch.autograd.grad(val, eps, create_graph=True); d2, = torch.autograd.grad(d1, eps, create_graph=True); d3, = torch.autograd.grad(d2, eps)
R = {'ids': ids[0].tolist(), 'v': 'sin(i+1)/16', 'g0': float(val), 'd1': float(d1), 'd2': float(d2), 'd3': float(d3), 'torch': torch.__version__}
json.dump(R, open('test/ref_taylor.json', 'w'), indent=1); print(R)
