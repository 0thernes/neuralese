// Frame wait for the nested demos. A timer whose callback is the promise resolver has no
// script URL, so the copy that follows it shows up on the parent as an empty-URL timer.
function nap() {
  let top = null;
  try { top = window.top; } catch { top = null; }
  const mark = top && typeof top.__timerResume === 'function';
  const stack = mark ? new Error('nap').stack : '';
  return new Promise((resolve) => {
    const go = () => {
      if (mark) top.__timerResume(`${stack}\n@${location.pathname}`);
      const Channel = globalThis.MessageChannel;
      if (typeof Channel === 'function') {
        const ch = new Channel();
        ch.port1.onmessage = () => { ch.port1.close(); ch.port2.close(); resolve(); };
        ch.port2.postMessage(0);
        return;
      }
      resolve();
    };
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(go);
    else go();
  });
}
