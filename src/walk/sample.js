// Display sampling. The stored tensor is complete. The picture shows a capped window and says so.

export function sampleIndices(n, cap, focus) {
  if (!Number.isInteger(n) || n < 0) throw new Error('length ' + n);
  const limit = Math.max(1, cap | 0);
  if (n <= limit) {
    const indices = [];
    for (let i = 0; i < n; i++) indices.push(i);
    return { indices, stride: 1, capped: false, total: n, focus: focus ?? null };
  }
  const stride = Math.ceil(n / limit);
  const indices = [];
  for (let i = 0; i < n && indices.length < limit; i += stride) indices.push(i);
  if (Number.isInteger(focus) && focus >= 0 && focus < n && !indices.includes(focus)) {
    indices[indices.length - 1] = focus;
    indices.sort((a, b) => a - b);
  }
  return { indices, stride, capped: true, total: n, focus: focus ?? null };
}

export function sampleNote(s, noun) {
  if (!s.capped) return `all ${s.total} ${noun}`;
  const focus = Number.isInteger(s.focus) && s.indices.includes(s.focus) ? `, including index ${s.focus}` : '';
  return `showing ${s.indices.length} of ${s.total} ${noun}, stride ${s.stride}${focus}`;
}

export function takeSample(values, cap, focus) {
  const plan = sampleIndices(values.length, cap, focus);
  const shown = plan.indices.map((i) => {
    const v = values[i];
    return Number.isFinite(v) ? v : null;
  });
  return { ...plan, shown, note: sampleNote(plan, 'values') };
}

// Largest finite entries, not a stride. Used for the vocabulary, where a stride would hide the greedy token.
export function topSample(values, cap, focus) {
  const n = values.length;
  const limit = Math.min(n, Math.max(1, cap | 0));
  const idx = [];
  for (let i = 0; i < n; i++) if (Number.isFinite(values[i])) idx.push(i);
  idx.sort((a, b) => values[b] - values[a]);
  const indices = idx.slice(0, limit);
  if (Number.isInteger(focus) && focus >= 0 && focus < n && !indices.includes(focus)) {
    indices.pop();
    indices.push(focus);
    indices.sort((a, b) => values[b] - values[a]);
  }
  const shown = indices.map((i) => values[i]);
  const note = n <= limit ? `all ${n} values` : `showing the ${indices.length} largest of ${n} values`;
  return { indices, shown, stride: null, capped: n > limit, total: n, focus: focus ?? null, note };
}
