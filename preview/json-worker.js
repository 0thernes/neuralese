// Fetch + JSON.parse, or a transferred ArrayBuffer and its SHA-256, off the page thread.
onmessage = async (e) => {
  try {
    const r = await fetch(e.data.url);
    if (!r.ok) throw new Error('HTTP ' + r.status);
    if (e.data.buf) {
      const buf = await r.arrayBuffer();
      const hex = e.data.sha ? [...new Uint8Array(await crypto.subtle.digest('SHA-256', buf))].map((b) => b.toString(16).padStart(2, '0')).join('') : '';
      postMessage({ buf, hex }, [buf]);
      return;
    }
    postMessage({ json: await r.json() });
  } catch (err) {
    postMessage({ err: String(err && err.message || err) });
  }
};
