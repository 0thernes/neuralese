// The page binds the engine worker here. Lab tools call steppedRun, which uses it when present.
let remote = null;
export function bindRemote(re) { remote = re; }
export function remoteEngine() { return remote; }
