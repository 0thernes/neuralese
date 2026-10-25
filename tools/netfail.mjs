// Network-failure check: the first two weight requests fail (HTTP 503, then an aborted connection); the loader must retry and finish.
// A third run blocks huggingface.co entirely and checks the error message + retry button. node tools/netfail.mjs [url]
import puppeteer from 'puppeteer-core';
const url = process.argv[2] || 'http://localhost:8765/', b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const run = async (mode) => { const p = await b.newPage(); await p.setRequestInterception(true); let n = 0; const msgs = [];
  p.on('request', (r) => { if (/huggingface\.co/.test(r.url()) && /safetensors/.test(r.url())) { n++; if (mode === 'down' || n === 1) return r.respond({ status: 503, body: 'unavailable' }); if (n === 2) return r.abort('connectionreset'); } r.continue(); });
  const poll = setInterval(() => p.$eval('#loadmsg', (e) => e.textContent).then((t) => { if (msgs.at(-1) !== t) msgs.push(t); }).catch(() => {}), 150);
  await p.goto(url); let ok; try { await p.waitForFunction(() => window.NEURALESE && window.NEURALESE_LAST, { timeout: mode === 'down' ? 20000 : 240000 }); ok = true; } catch { ok = false; }
  clearInterval(poll); const btn = await p.$eval('#loadRetry', (e) => !e.classList.contains('hidden')).catch(() => null); await p.close(); return { mode, requests: n, loaded: ok, retryButton: btn, retryMsgs: msgs.filter((m) => /retrying|✖/.test(m)).slice(0, 4) }; };
const r1 = await run('flaky'), r2 = await run('down'); console.log(JSON.stringify([r1, r2], null, 1)); await b.close();
process.exit(r1.loaded && !r2.loaded && r2.retryButton ? 0 : 1);
