// Builds www/ for packaging from the repo root with the same file set as gh-pages (tools/build-www.mjs).
const { execFileSync } = require('node:child_process'); const path = require('node:path');
execFileSync(process.execPath, [path.join(__dirname, '..', 'tools', 'build-www.mjs'), path.join(__dirname, 'www')], { cwd: path.join(__dirname, '..'), stdio: 'inherit' });
