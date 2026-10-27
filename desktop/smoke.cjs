// Desktop smoke: launch the packaged app (linux-unpacked) with a CDP port, wait for the web app to finish loading a model.
// Usage: node smoke.cjs <path-to-binary> [readyExpr]
const { spawn } = require('node:child_process'); const puppeteer = require('puppeteer-core');
const bin = process.argv[2], ready = process.argv[3] || 'window.NEURALESE && window.NEURALESE.W';
(async () => { const pr = spawn(bin, ['--no-sandbox', '--remote-debugging-port=9333'], { stdio: 'inherit' }); let ok = false;
  try { await new Promise((r) => setTimeout(r, 6000)); const b = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9333' });
    const [p] = await b.pages(); const errs = []; p.on('pageerror', (e) => errs.push(e.message));
    await p.waitForFunction(ready, { timeout: 300000 }); const info = await p.evaluate(() => ({ url: location.href, title: document.title, text: document.body.innerText.slice(0, 200) }));
    console.log('DESKTOP SMOKE OK', JSON.stringify(info), 'pageerrors:', errs.length); ok = true; b.disconnect();
  } catch (e) { console.error('DESKTOP SMOKE FAIL', e.message); } finally { pr.kill(); process.exit(ok ? 0 : 1); } })();
