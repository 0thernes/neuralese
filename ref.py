# PyTorch reference for NEURALESE numerical tests (transformers GPTNeo, no TransformerLens available offline).
import json, torch, numpy as np
from transformers import GPTNeoForCausalLM, GPT2TokenizerFast
torch.set_grad_enabled(False)
m = GPTNeoForCausalLM.from_pretrained('roneneldan/TinyStories-8M', revision='refs/pr/1').eval()
tk = GPT2TokenizerFast.from_pretrained('roneneldan/TinyStories-8M')
R = {}
P = 'Once upon a time, there was a little girl named Lily. She loved to'
ids = tk(P, return_tensors='pt').input_ids; R['lens_ids'] = ids[0].tolist()
out = m(ids, output_hidden_states=True)
hs = out.hidden_states  # hs[0]=embed, hs[l]=resid after block l-1 (l<8), hs[8] has ln_f applied
lens = []
for l in range(9):
    h = hs[l] if l == 8 else m.transformer.ln_f(hs[l])
    lg = torch.log_softmax(m.lm_head(h)[0], -1)
    lens.append({'top': lg.argmax(-1).tolist(), 'lp': lg.max(-1).values.tolist()})
R['lens'] = lens
R['final_logits_last'] = out.logits[0, -1, :20].tolist()
# DLA per head at last position for target = argmax
tgt = int(out.logits[0, -1].argmax()); R['dla_target'] = tgt
z_store = {}
hooks = []
for l, blk in enumerate(m.transformer.h):
    hooks.append(blk.attn.attention.out_proj.register_forward_pre_hook(lambda mod, inp, l=l: z_store.__setitem__(l, inp[0].clone())))
fin = {}
hooks.append(m.transformer.ln_f.register_forward_pre_hook(lambda mod, inp: fin.__setitem__('x', inp[0].clone())))
m(ids)
for h in hooks: h.remove()
x = fin['x'][0, -1]; mu = x.mean(); rstd = 1 / torch.sqrt(((x - mu) ** 2).mean() + 1e-5)
u = m.transformer.ln_f.weight * m.transformer.wte.weight[tgt]; u = u - u.mean()
dla = []
for l in range(8):
    O = m.transformer.h[l].attn.attention.out_proj.weight; z = z_store[l][0, -1]
    for h in range(16):
        c = O[:, h*16:(h+1)*16] @ z[h*16:(h+1)*16]
        dla.append(float(rstd * (c @ u)))
R['dla_heads'] = dla
# activation patching
clean = 'Lily and Tom went to the park. Lily gave the ball to'; corr = 'Lily and Tom went to the park. Tom gave the ball to'
ci = tk(clean, return_tensors='pt').input_ids; xi = tk(corr, return_tensors='pt').input_ids
A = tk(' Tom').input_ids[0]; B = tk(' Lily').input_ids[0]; R['patch'] = {'clean': clean, 'corr': corr, 'ans': A, 'wrong': B}
def metric(o): return float(o.logits[0, -1, A] - o.logits[0, -1, B])
co = m(ci, output_hidden_states=True); C = metric(co); X = metric(m(xi))
T = ci.shape[1]; M = np.zeros((8, T))
for l in range(8):
    for p in range(T):
        src = co.hidden_states[l][0, p].clone()
        def pre(mod, args, kwargs, src=src, p=p):
            hsx = args[0].clone(); hsx[0, p] = src; return (hsx,) + args[1:], kwargs
        hk = m.transformer.h[l].register_forward_pre_hook(pre, with_kwargs=True)
        M[l, p] = metric(m(xi)); hk.remove()
R['patch_resid'] = M.tolist(); R['patch_clean'] = C; R['patch_corr'] = X
# head patching (z of head, all positions)
zc = {}
hk = [m.transformer.h[l].attn.attention.out_proj.register_forward_pre_hook(lambda mod, inp, l=l: zc.__setitem__(l, inp[0].clone())) for l in range(8)]
m(ci); [h.remove() for h in hk]
MH = np.zeros((8, 16))
for l in range(8):
    for h in range(16):
        def pre(mod, inp, l=l, h=h):
            z = inp[0].clone(); z[0, :, h*16:(h+1)*16] = zc[l][0, :, h*16:(h+1)*16]; return (z,)
        k = m.transformer.h[l].attn.attention.out_proj.register_forward_pre_hook(pre)
        MH[l, h] = metric(m(xi)); k.remove()
R['patch_heads'] = MH.tolist()
# path patch head -> logits (direct)
zx = {}; fx = {}
hk = [m.transformer.h[l].attn.attention.out_proj.register_forward_pre_hook(lambda mod, inp, l=l: zx.__setitem__(l, inp[0].clone())) for l in range(8)]
hk.append(m.transformer.ln_f.register_forward_pre_hook(lambda mod, inp: fx.__setitem__('x', inp[0].clone())))
m(xi); [h.remove() for h in hk]
PP = np.zeros((8, 16))
for l in range(8):
    O = m.transformer.h[l].attn.attention.out_proj.weight
    for h in range(16):
        dz = zc[l][0, -1, h*16:(h+1)*16] - zx[l][0, -1, h*16:(h+1)*16]
        xx = fx['x'][0, -1] + O[:, h*16:(h+1)*16] @ dz
        lg = m.lm_head(m.transformer.ln_f(xx))
        PP[l, h] = float(lg[A] - lg[B])
R['path_heads'] = PP.tolist()
R['svd_L3fc'] = np.linalg.svd(m.transformer.h[3].mlp.c_fc.weight.numpy().astype(np.float64), compute_uv=False)[:32].tolist()
R['svd_L0q'] = np.linalg.svd(m.transformer.h[0].attn.attention.q_proj.weight.numpy().astype(np.float64), compute_uv=False).tolist()
json.dump(R, open('ref.json', 'w'))
print('C', C, 'X', X, 'maxpatch', M.max(), 'ok')
