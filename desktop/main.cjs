// Electron desktop shell. Serves the bundled web app from app://local/ (a privileged, secure custom scheme) so fetch(),
// module Web Workers, WebAssembly and the service worker behave as on https. Remote downloads (e.g. pretrained ONNX
// models) go straight to their https origins and keep the web app's own SHA-256 checks.
const { app, BrowserWindow, protocol, net, shell, Menu } = require('electron');
const path = require('node:path'); const { pathToFileURL } = require('node:url');
const ROOT = path.join(__dirname, 'www');
// Electron 42 (Chromium 14x) no longer falls back to software WebGL automatically. Without this switch, machines with no usable GPU
// (VMs, blocklisted drivers, CI/Xvfb) fail with "Error creating WebGL context" and the lab never loads. The app only renders its own bundled content.
app.commandLine.appendSwitch('enable-unsafe-swiftshader');
protocol.registerSchemesAsPrivileged([{ scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true, allowServiceWorkers: true } }]);
function win() {
  const w = new BrowserWindow({ width: 1400, height: 920, backgroundColor: '#0b0d10', title: app.getName(), webPreferences: { contextIsolation: true, sandbox: true, nodeIntegration: false } });
  w.webContents.setWindowOpenHandler(({ url }) => { if (/^https?:/.test(url)) shell.openExternal(url); return { action: 'deny' }; });
  w.webContents.on('will-navigate', (e, url) => { if (!url.startsWith('app://')) { e.preventDefault(); shell.openExternal(url); } });
  w.loadURL('app://local/index.html');
}
app.whenReady().then(() => {
  protocol.handle('app', (req) => { const u = new URL(req.url); let p = decodeURIComponent(u.pathname); if (p.endsWith('/')) p += 'index.html';
    const f = path.normalize(path.join(ROOT, p)); if (!f.startsWith(ROOT)) return new Response('forbidden', { status: 403 });
    return net.fetch(pathToFileURL(f).toString()); });
  Menu.setApplicationMenu(Menu.buildFromTemplate([{ role: 'fileMenu' }, { role: 'editMenu' }, { role: 'viewMenu' }, { role: 'windowMenu' }]));
  win(); app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) win(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
