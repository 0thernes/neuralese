import puppeteer from 'puppeteer-core';
for (const args of [['--enable-unsafe-webgpu','--enable-features=Vulkan','--use-webgpu-adapter=swiftshader'],['--enable-unsafe-webgpu','--enable-features=Vulkan,WebGPU','--use-vulkan=swiftshader','--use-webgpu-adapter=swiftshader','--disable-vulkan-surface']]) {
const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox',...args]});
const p=await b.newPage();await p.goto('http://localhost:8816/README.md').catch(()=>{});
console.log(args.join(' '),await p.evaluate(async()=>{if(!navigator.gpu)return 'no navigator.gpu';const a=await navigator.gpu.requestAdapter();if(!a)return 'no adapter';return JSON.stringify(a.info||{})+' '+a.limits.maxStorageBufferBindingSize}));await b.close();}
