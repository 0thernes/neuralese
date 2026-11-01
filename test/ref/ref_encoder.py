# Float64 HF references for src/arch/encoder.js (test/encoder.test.mjs). Inputs are deterministic closed-form arrays (same formula in JS).
import json, math, os, torch
from transformers import ViTForImageClassification, CLIPModel, WhisperModel
ROOT = os.path.join(os.path.dirname(__file__), '..', '..', 'model', 'arch'); torch.set_grad_enabled(False)
def img(S): return torch.tensor([[[math.sin(0.11 * x + 0.7 * c) * math.cos(0.13 * y - 0.3 * c) * 0.9 for x in range(S)] for y in range(S)] for c in range(3)], dtype=torch.float64)[None]
def mel(M, T): return torch.tensor([[math.sin(0.02 * t + 0.3 * m) * 0.8 - 0.2 for t in range(T)] for m in range(M)], dtype=torch.float64)[None]
def sl(h): return [x[0, :4, :16].tolist() for x in h]
out = {}
m = ViTForImageClassification.from_pretrained(os.path.join(ROOT, 'vit-base-patch16-224'), attn_implementation='eager').double().eval()
o = m(pixel_values=img(224), output_hidden_states=True, output_attentions=True)
out['vit'] = {'logits': o.logits[0].tolist(), 'hidden': sl(o.hidden_states), 'attn0': o.attentions[0][0, 0, :8].tolist(), 'attnL': o.attentions[-1][0, 5, :4].tolist()}
m = CLIPModel.from_pretrained(os.path.join(ROOT, 'CLIP-ViT-B-32-laion2B-s34B-b79K'), attn_implementation='eager').double().eval()
v = m.vision_model(pixel_values=img(224), output_hidden_states=True, output_attentions=True)
out['clip'] = {'image_embeds': m.visual_projection(v.pooler_output)[0].tolist(), 'hidden': sl(v.hidden_states), 'attn0': v.attentions[0][0, 0, :8].tolist(), 'attnL': v.attentions[-1][0, 5, :4].tolist()}
m = WhisperModel.from_pretrained(os.path.join(ROOT, 'whisper-tiny.en'), attn_implementation='eager').double().eval()
e = m.encoder(input_features=mel(80, 3000), output_hidden_states=True, output_attentions=True)
out['whisper'] = {'hidden': sl(e.hidden_states), 'last_tail': e.last_hidden_state[0, -3:, :32].tolist(), 'attn0': e.attentions[0][0, 0, :4].tolist(), 'attnL': e.attentions[-1][0, 5, :4].tolist()}
json.dump(out, open(os.path.join(os.path.dirname(__file__), 'ref_encoder.json'), 'w')); print({k: len(json.dumps(v)) for k, v in out.items()})
