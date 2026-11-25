// Electron desktop shell. Serves the bundled web app from app://local/ (a privileged, secure custom scheme) so fetch(),
// module Web Workers, WebAssembly and the service worker behave as on https. Remote downloads (e.g. pretrained ONNX
// models) go straight to their https origins and keep the web app's own SHA-256 checks.
const { app, BrowserWindow, protocol, net, shell, Menu } = require('electron');
const path = require('node:path'); const { pathToFileURL } = require('node:url');
const { safeAppPath } = require('./safe-path.cjs');
const ROOT = path.join(__dirname, 'www');
// Software WebGL (SwiftShader) is OFF by default (v15.3) and only enabled as a GPU-failure fallback:
//   • explicitly: `--swiftshader` on the command line or NEURALESE_SWIFTSHADER=1;
//   • automatically: if after start-up Chromium reports WebGL unavailable, or the GPU process crashes, a marker file is written to
//     userData and the app relaunches once with the switch (the marker keeps it on for later runs; delete it to retry the GPU).
// Electron 42 (Chromium 14x) no longer falls back to software WebGL by itself, so machines with no usable GPU (VMs, blocklisted
// drivers, CI/Xvfb) would otherwise fail with "Error creating WebGL context". The app only renders its own bundled content.
const fs = require('node:fs');
const MARK = () => path.join(app.getPath('userData'), 'gpu-fallback-swiftshader');
const SW = process.argv.includes('--swiftshader') || process.env.NEURALESE_SWIFTSHADER === '1' || (() => { try { return fs.existsSync(MARK()); } catch { return false; } })();
if (SW) app.commandLine.appendSwitch('enable-unsafe-swiftshader');
function fallBackToSoftware(why) {
  if (SW) return; console.warn('[neuralese] GPU unusable (' + why + '); relaunching with SwiftShader software WebGL');
  try { fs.mkdirSync(app.getPath('userData'), { recursive: true }); fs.writeFileSync(MARK(), why + '\n'); } catch {}
  app.relaunch({ args: process.argv.slice(1).concat('--swiftshader') }); app.exit(0);
}
app.on('child-process-gone', (_e, d) => { if (d.type === 'GPU' && d.reason !== 'clean-exit') fallBackToSoftware('gpu process ' + d.reason); });
protocol.registerSchemesAsPrivileged([{ scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true, allowServiceWorkers: true } }]);
function win() {
  const w = new BrowserWindow({ width: 1400, height: 920, backgroundColor: '#0b0d10', title: app.getName(), webPreferences: { contextIsolation: true, sandbox: true, nodeIntegration: false } });
  w.webContents.setWindowOpenHandler(({ url }) => { if (/^https?:/.test(url)) shell.openExternal(url); return { action: 'deny' }; });
  w.webContents.on('will-navigate', (e, url) => { if (!url.startsWith('app://')) { e.preventDefault(); shell.openExternal(url); } });
  w.loadURL('app://local/index.html');
}
app.whenReady().then(() => {
  try { const st = app.getGPUFeatureStatus(); if (!SW && /^(unavailable|disabled)/.test(String(st.webgl))) fallBackToSoftware('webgl ' + st.webgl); } catch {}
  protocol.handle('app', (req) => {
    let u; try { u = new URL(req.url); } catch { return new Response('bad url', { status: 400 }); }
    const f = safeAppPath(ROOT, u.pathname);
    if (!f) return new Response('forbidden', { status: 403 });
    return net.fetch(pathToFileURL(f).toString());
  });
  Menu.setApplicationMenu(Menu.buildFromTemplate([{ role: 'fileMenu' }, { role: 'editMenu' }, { role: 'viewMenu' }, { role: 'windowMenu' }]));
  win(); app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) win(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
