// Headless shots of the Deep Walk zoom ladder. Not part of CI.
// The page asks Hugging Face for TinyStories. This process answers from the pinned local files
// and adds the CORS header the browser requires. It does not change the app.
import fs from 'node:fs';
import http from 'node:http';
import puppeteer from 'puppeteer-core';

const root = new URL('..', import.meta.url).pathname;
const outDir = '/opt/cursor/artifacts/screenshots';
fs.mkdirSync(outDir, { recursive: true });
const files = {
  '/model.safetensors': root + 'model/model.safetensors',
  '/vocab.json': root + 'model/vocab.json',
  '/merges.txt': root + 'model/merges.txt',
};
const fileServer = http.createServer((req, res) => {
  const f = files[new URL(req.url, 'http://x').pathname];
  if (!f) { res.writeHead(404); return res.end(); }
  const st = fs.statSync(f);
  const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Expose-Headers': 'Content-Range, Content-Length, Accept-Ranges', 'Accept-Ranges': 'bytes', 'Content-Type': 'application/octet-stream' };
  if (req.method === 'OPTIONS') { res.writeHead(204, { ...headers, 'Access-Control-Allow-Headers': '*' }); return res.end(); }
  const range = req.headers.range && /bytes=(\d+)-(\d*)/.exec(req.headers.range);
  if (!range) { res.writeHead(200, { ...headers, 'Content-Length': st.size }); return fs.createReadStream(f).pipe(res); }
  const a = +range[1], b = range[2] ? +range[2] : st.size - 1;
  res.writeHead(206, { ...headers, 'Content-Range': `bytes ${a}-${b}/${st.size}`, 'Content-Length': b - a + 1 });
  fs.createReadStream(f, { start: a, end: b }).pipe(res);
});
await new Promise((r) => fileServer.listen(8766, r));

const browser = await puppeteer.launch({
  executablePath: process.env.CHROME || '/usr/bin/google-chrome',
  headless: 'new',
  protocolTimeout: 180000,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
page.on('console', (m) => { if (m.type() === 'error') console.log('PAGE', m.text().slice(0, 240)); });
page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
await page.setRequestInterception(true);
page.on('request', (req) => {
  const u = req.url();
  const map = [
    ['model.safetensors', 'http://127.0.0.1:8766/model.safetensors'],
    ['vocab.json', 'http://127.0.0.1:8766/vocab.json'],
    ['merges.txt', 'http://127.0.0.1:8766/merges.txt'],
  ];
  const hit = map.find(([k]) => u.includes(k));
  if (!hit) { req.continue().catch(() => {}); return; }
  const headers = { ...req.headers() };
  delete headers.host;
  req.continue({ url: hit[1], headers }).catch((e) => console.log('continue', e.message));
});
await page.evaluateOnNewDocument(() => localStorage.setItem('neuralese.v17.toured', '1'));
await page.goto('http://localhost:8765/', { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForFunction(() => document.querySelector('#loader')?.style.display === 'none' && window.NEURALESE?.deepWalk, { timeout: 180000 });
console.log('loaded');
await page.click('[data-ws="walk"]');
await page.waitForSelector('input[aria-label="walk prompt"]');
await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => b.textContent === 'Run forward')?.click());
await page.waitForFunction(() => /greedy next/.test(document.body.innerText), { timeout: 120000 });
console.log('walk', (await page.evaluate(() => document.querySelector('.cosmos-hud')?.textContent || '')).replace(/\s+/g, ' ').slice(0, 280));
await new Promise((r) => setTimeout(r, 1500));

async function clickText(text) {
  const ok = await page.evaluate((t) => {
    const b = [...document.querySelectorAll('.walk button')].find((x) => x.textContent?.trim() === t);
    if (!b) return false;
    b.click();
    return true;
  }, text);
  if (!ok) throw new Error('no button ' + text);
  await new Promise((r) => setTimeout(r, 1100));
}

for (const [name, label] of [
  ['model', 'Model'],
  ['layer', 'Layer'],
  ['unit', 'Head / neuron'],
  ['qkv', 'Q, K, V'],
  ['matmul', 'Matmul'],
  ['dot', 'Dot product'],
  ['float', 'Float'],
  ['gates', 'Gates'],
  ['voltage', 'Voltage'],
]) {
  await clickText(label);
  const file = `${outDir}/deep-walk-${name}.png`;
  await page.screenshot({ path: file });
  console.log('shot', name, fs.statSync(file).size);
}
await browser.close();
fileServer.close();
console.log('done');
