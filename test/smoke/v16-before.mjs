import puppeteer from 'puppeteer-core'; import fs from 'node:fs';
const out='/workspace/neuralese-v17/compare/before'; fs.mkdirSync(out,{recursive:true});
const b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless:'new', protocolTimeout:1800000, args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox'] });
const res={};
for (const [w,h] of [[1440,900],[1240,700],[390,844]]) {
  const p = await b.newPage(); await p.setViewport({width:w,height:h}); const errs=[]; p.on('console',m=>m.type()==='error'&&errs.push(m.text()));
  const t0=Date.now(); await p.goto(process.argv[2],{waitUntil:'load'}); await p.waitForFunction(()=>window.NEURALESE_LAST,{timeout:600000}); const loadMs=Date.now()-t0;
  const perf=await p.evaluate(()=>{const n=performance.getEntriesByType('navigation')[0];const f=performance.getEntriesByName('first-contentful-paint')[0];return {dcl:Math.round(n.domContentLoadedEventEnd),load:Math.round(n.loadEventEnd),fcp:Math.round(f?.startTime||0),bytes:performance.getEntriesByType('resource').reduce((a,r)=>a+(r.transferSize||0),0)+(n.transferSize||0)}});
  res[`${w}x${h}`]={loadMs,...perf,consoleErrors:errs.length};
  for (const k of ['home','v3d','attn','nmoe']) { await p.evaluate(k=>window.NEURALESE?.showTab?.(k)||document.querySelector(`[data-k="${k}"]`)?.click(),k); await new Promise(r=>setTimeout(r,1500)); await p.screenshot({path:`${out}/${w}x${h}-${k}.png`}); }
  await p.close();
}
fs.writeFileSync(out+'/report.json',JSON.stringify(res,null,1)); console.log(JSON.stringify(res)); await b.close();
