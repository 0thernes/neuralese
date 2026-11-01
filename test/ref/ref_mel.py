# HF WhisperFeatureExtractor reference for whisperLogMel (test/encoder.test.mjs): 2 s chirp + tone, deterministic.
import json, math, os, numpy as np
from transformers import WhisperFeatureExtractor
fe = WhisperFeatureExtractor.from_pretrained(os.path.join(os.path.dirname(__file__), '..', '..', 'model', 'arch', 'whisper-tiny.en'))
sr = 16000; t = np.arange(2 * sr) / sr; a = (0.3 * np.sin(2 * np.pi * (200 * t + 400 * t * t)) + 0.1 * np.sin(2 * np.pi * 1000 * t)).astype(np.float64)
f = fe(a, sampling_rate=sr, return_tensors='np').input_features[0].astype(np.float64)
json.dump({'cols': f[:, ::97].tolist(), 'stride': 97, 'filters_mel10': fe.mel_filters[:, 10].tolist()}, open(os.path.join(os.path.dirname(__file__), 'ref_mel.json'), 'w')); print(f.shape, f.min(), f.max())
