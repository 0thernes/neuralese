# Reference logits for the v16 Arch interface (test/arch.test.mjs). For each small real HF model (local copy under model/arch/<name>
# or model/ for TinyStories-8M), run a fixed token sequence through transformers in float64 (and float32 for the report) and store:
# last-position full logits, the first 256 vocab logits at every position, per-layer hidden-state slices, and layer-0 attentions.
import json, os, sys, torch
from transformers import AutoModelForCausalLM
ROOT = os.path.join(os.path.dirname(__file__), '..', '..')
MODELS = {'gpt_neo': 'model/arch/TinyStories-8M', 'gpt2': 'model/arch/distilgpt2', 'llama': 'model/arch/SmolLM-135M', 'qwen2': 'model/arch/Qwen2.5-0.5B'}
IDS = [464, 2068, 7586, 21831, 18045, 625, 262, 16931, 3290, 13, 1881, 1110]
out = {'ids': IDS}
for name in (sys.argv[1:] or MODELS):
    path = os.path.join(ROOT, MODELS[name])
    R = {}
    for dt in (torch.float64, torch.float32):
        m = AutoModelForCausalLM.from_pretrained(path, torch_dtype=torch.float32, attn_implementation='eager').to(dt).eval()
        with torch.no_grad(): o = m(torch.tensor([IDS]), output_hidden_states=True, output_attentions=True)
        lg = o.logits[0].double()
        if dt == torch.float64:
            R = {'last': lg[-1].tolist(), 'head': lg[:, :256].tolist(), 'hidden': [h[0, :, :16].double().tolist() for h in o.hidden_states], 'attn0': o.attentions[0][0, 0].double().tolist(), 'model_type': m.config.model_type}
            ref = lg
        else:
            R['f32_vs_f64_maxabs'] = float((lg - ref).abs().max())
        del m
    out[name] = R; print(name, R['model_type'], 'torch f32 vs f64 max |dlogit| =', R['f32_vs_f64_maxabs'])
p = os.path.join(os.path.dirname(__file__), 'ref_arch.json')
prev = json.load(open(p)) if os.path.exists(p) else {}
prev.update(out); json.dump(prev, open(p, 'w'))
