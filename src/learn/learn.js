// Learning center UI: Bible, Glossary, Index, Course (lectures, diagrams, labs, quizzes). Progress in localStorage.
import { frame } from '../coop.js?v=170';
let GLOSSARY = [], BIBLE = [], COURSE = [];
let loading = null;
// The catalogues are separate modules. Evaluating all three while this module loads was one long script.
export function loadCatalog() {
  if (!loading) loading = (async () => {
    GLOSSARY = (await import('./glossary.js?v=170')).GLOSSARY; await frame();
    BIBLE = (await import('./bible.js?v=170')).BIBLE; await frame();
    COURSE = (await import('./course.js?v=170')).COURSE;
    return { GLOSSARY, BIBLE, COURSE };
  })();
  return loading;
}
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
export const md = (s) => esc(s).split(/\n\n+/).map((p) => '<p>' + p.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\n/g, '<br>') + '</p>').join('');
const PKEY = 'neuralese.learn.v5';
export const progress = {
  get() { try { return JSON.parse(localStorage.getItem(PKEY) || '{}'); } catch { return {}; } },
  set(id, v) { const p = progress.get(); p[id] = { ...(p[id] || {}), ...v }; try { localStorage.setItem(PKEY, JSON.stringify(p)); } catch { /* ignore */ } return p; },
  reset() { localStorage.removeItem(PKEY); },
};
export function gradeQuiz(lesson, answers) { let c = 0; lesson.quiz.forEach((q, i) => { if (answers[i] === q.a) c++; }); return { correct: c, total: lesson.quiz.length, pass: c === lesson.quiz.length }; }
// index: every glossary term, bible section and lesson, searchable
export function buildIndex() {
  const ix = [];
  for (const [t, d] of GLOSSARY) ix.push({ kind: 'term', key: t, text: d, ref: 'g:' + t });
  for (const b of BIBLE) ix.push({ kind: 'manual', key: b.title, text: b.body, ref: 'b:' + b.id });
  for (const l of COURSE) ix.push({ kind: 'lesson', key: l.title, text: l.lecture, ref: 'c:' + l.id });
  return ix.sort((a, b) => a.key.localeCompare(b.key));
}
export function search(q) { q = q.trim().toLowerCase(); if (!q) return []; return buildIndex().map((x) => ({ ...x, s: (x.key.toLowerCase().includes(q) ? 10 : 0) + (x.text.toLowerCase().includes(q) ? 1 : 0) })).filter((x) => x.s).sort((a, b) => b.s - a.s); }

export const learnMarkup = ['LEARN', 'Learning center', `<div class="r lnav" role="toolbar" aria-label="learning center sections"><button data-lv="course" class="on">Course</button><button data-lv="bible">Bible</button><button data-lv="gloss">Glossary</button><button data-lv="index">Index</button><input id="lnQ" placeholder="search everything…" aria-label="search the learning center"/></div>
<div class="prog" id="lnProg" title="course progress"><i></i></div><div id="lnBody" class="learn"></div>`];

export function mountLearn(A) {
  const body = $('lnBody'); let view = 'course';
  const bar = () => { const p = progress.get(), n = COURSE.filter((l) => p[l.id]?.pass).length; const e = $('lnProg'); e.firstElementChild.style.width = (n / COURSE.length * 100) + '%'; e.title = `${n}/${COURSE.length} lessons passed`; return n; };
  const clearBody = async () => { while (body.firstChild) { let n = 0; while (body.firstChild && n < 12) { body.firstChild.remove(); n++; } await frame(); } };
  const views = {
    course() { void (async () => { await loadCatalog(); await clearBody(); const p = progress.get(); const head = document.createElement('p'); head.className = 'sm'; head.innerHTML = `${bar()}/${COURSE.length} lessons passed · labs run real commands in the terminal · <button id="lnReset">reset progress</button>`; body.appendChild(head); $('lnReset').onclick = () => { progress.reset(); views.course(); }; for (let i = 0; i < COURSE.length; i++) { const l = COURSE[i]; const card = document.createElement('div'); card.className = 'lcard'; card.dataset.l = l.id; card.tabIndex = 0; card.setAttribute('role', 'button'); card.innerHTML = `<b>${esc(l.title)}</b> <span class="sm">${l.level} · ${l.minutes} min</span> ${p[l.id]?.pass ? '<span class="ok">✔ passed</span>' : p[l.id] ? `<span class="sm">${p[l.id].best}/${l.quiz.length}</span>` : ''}`; card.onclick = () => lesson(l.id); card.onkeydown = (e) => e.key === 'Enter' && lesson(l.id); body.appendChild(card); await frame(); } })(); },
    bible() { void (async () => { await loadCatalog(); await clearBody(); const nav = document.createElement('nav'); nav.className = 'toc'; nav.innerHTML = BIBLE.map((b) => `<a href="#" data-b="${b.id}">${esc(b.title)}</a>`).join(' · '); body.appendChild(nav); for (const b of BIBLE) { await frame(); const sec = document.createElement('section'); sec.id = 'bb_' + b.id; sec.innerHTML = `<h3>${esc(b.title)}</h3>${md(b.body)}`; body.appendChild(sec); } nav.querySelectorAll('[data-b]').forEach((a) => (a.onclick = (e) => { e.preventDefault(); $('bb_' + a.dataset.b)?.scrollIntoView(); })); })(); },
    gloss(focus) { void (async () => { await loadCatalog(); await clearBody(); const note = document.createElement('p'); note.className = 'sm'; note.textContent = GLOSSARY.length + ' terms'; const dl = document.createElement('dl'); dl.className = 'gloss'; body.append(note, dl); for (let i = 0; i < GLOSSARY.length; i++) { const [t, d, r] = GLOSSARY[i]; const dt = document.createElement('dt'); dt.id = 'gl_' + slug(t); dt.textContent = t; const dd = document.createElement('dd'); dd.innerHTML = esc(d) + (r.length ? `<br><span class="sm">see: ${r.map((x) => `<a href="#" data-g="${esc(x)}">${esc(x)}</a>`).join(', ')}</span>` : ''); dl.append(dt, dd); if ((i & 7) === 7) await frame(); } dl.querySelectorAll('[data-g]').forEach((a) => (a.onclick = (e) => { e.preventDefault(); goTerm(a.dataset.g); })); if (focus) goTerm(focus); })(); },
    index() { void (async () => { await loadCatalog(); await clearBody(); const box = document.createElement('div'); box.className = 'idx'; body.appendChild(box); const ix = buildIndex(); let cur = ''; for (let i = 0; i < ix.length; i++) { const x = ix[i]; const L0 = x.key[0].toUpperCase(); if (L0 !== cur) { const h = document.createElement('h4'); h.textContent = L0; box.appendChild(h); cur = L0; } const a = document.createElement('a'); a.href = '#'; a.dataset.r = x.ref; a.textContent = x.key; const sm = document.createElement('span'); sm.className = 'sm'; sm.textContent = x.kind; box.append(a, document.createTextNode(' '), sm, document.createElement('br')); if ((i & 15) === 15) await frame(); } wireRefs(); })(); },
  };
  const slug = (t) => t.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  function goTerm(t) { if (view !== 'gloss') return show('gloss', t); const e = $('gl_' + slug(t)); if (e) { e.scrollIntoView(); e.classList.add('hl'); setTimeout(() => e.classList.remove('hl'), 1500); } }
  function open(ref) { const [k, v] = [ref.slice(0, 1), ref.slice(2)]; if (k === 'g') goTerm(v); else if (k === 'b') { show('bible'); $('bb_' + v).scrollIntoView(); } else lesson(v); }
  function wireRefs() { body.querySelectorAll('[data-r]').forEach((a) => (a.onclick = (e) => { e.preventDefault(); open(a.dataset.r); })); }
  function show(v, arg) { view = v; document.querySelectorAll('.lnav button').forEach((b) => b.classList.toggle('on', b.dataset.lv === v)); views[v](arg); }
  function lesson(id) {
    const l = COURSE.find((x) => x.id === id); const i = COURSE.indexOf(l);
    body.innerHTML = `<p><a href="#" id="lnBack">← all lessons</a></p><h3>${esc(l.title)}</h3><p class="sm">${l.level} · ${l.minutes} min</p>${md(l.lecture)}<div class="svgbox">${l.diagram}</div>
<h4>Lab</h4><ol class="lab">${l.lab.map((c) => `<li><code>${esc(c)}</code></li>`).join('')}</ol><p class="sm">${esc(l.labNotes)}</p><div class="r"><button class="pri" id="lnLab">▶ run lab in terminal</button><span class="sm" id="lnLabSt"></span></div>
<h4>Quiz</h4><form id="lnQuiz">${l.quiz.map((q, qi) => `<fieldset class="quiz"><legend>${qi + 1}. ${esc(q.q)}</legend>${q.options.map((o, oi) => `<label><input type="radio" name="q${qi}" value="${oi}"/> ${esc(o)}</label>`).join('<br>')}<div class="why sm" id="why${qi}"></div></fieldset>`).join('')}<div class="r"><button class="pri" type="submit">check answers</button><span id="lnScore"></span>${i + 1 < COURSE.length ? `<button type="button" id="lnNext">next lesson →</button>` : ''}</div></form>`;
    $('lnBack').onclick = (e) => { e.preventDefault(); show('course'); };
    if ($('lnNext')) $('lnNext').onclick = () => lesson(COURSE[i + 1].id);
    $('lnLab').onclick = async () => { const st = $('lnLabSt'); A.showTab('term'); let ok = 0; for (const c of l.lab) { st.textContent = `running: ${c}`; const r = await A.term(c); if (r !== null) ok++; } st.textContent = `✔ ${ok}/${l.lab.length} commands ran`; progress.set(l.id, { lab: true }); A.showTab('learn'); };
    $('lnQuiz').onsubmit = (e) => { e.preventDefault(); const ans = l.quiz.map((_, qi) => { const x = body.querySelector(`input[name=q${qi}]:checked`); return x ? +x.value : -1; });
      const g = gradeQuiz(l, ans); l.quiz.forEach((q, qi) => { const w = $('why' + qi); w.innerHTML = (ans[qi] === q.a ? '<span class="ok">✔ correct</span> ' : `<span class="err">✖ answer: ${esc(q.options[q.a])}</span> `) + esc(q.why); });
      const best = Math.max(g.correct, progress.get()[l.id]?.best || 0); progress.set(l.id, { best, pass: (progress.get()[l.id]?.pass) || g.pass }); $('lnScore').textContent = `${g.correct}/${g.total}${g.pass ? ' — passed ✔' : ''}`; bar(); };
    body.scrollTop = 0;
  }
  document.querySelectorAll('.lnav button').forEach((b) => (b.onclick = () => show(b.dataset.lv)));
  $('lnQ').addEventListener('input', (e) => { void (async () => { await loadCatalog(); const r = search(e.target.value); if (!e.target.value.trim()) return show(view); body.innerHTML = `<p class="sm">${r.length} results</p>` + r.slice(0, 80).map((x) => `<div><a href="#" data-r="${esc(x.ref)}">${esc(x.key)}</a> <span class="sm">${x.kind}</span><div class="sm">${esc(x.text.slice(0, 160))}…</div></div>`).join(''); wireRefs(); })(); });
  show('course');
  return { show, lesson, goTerm };
}
