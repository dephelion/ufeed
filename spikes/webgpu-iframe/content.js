const api = globalThis.browser ?? globalThis.chrome;

const panel = document.createElement('div');
panel.style.cssText = `position:fixed;top:16px;right:16px;z-index:2147483647;width:340px;
  max-height:70vh;overflow:auto;background:#0c0a09;color:#fafaf9;border-radius:10px;
  padding:14px 16px;font:12px/1.55 ui-monospace,SFMono-Regular,Menlo,monospace;
  box-shadow:0 4px 24px rgba(0,0,0,.5);white-space:pre-wrap`;
panel.textContent = 'Lensing spike 12.1 — probing…';
document.documentElement.appendChild(panel);

const frame = document.createElement('iframe');
frame.src = api.runtime.getURL('engine.html');
frame.allow = 'webgpu';
frame.setAttribute('aria-hidden', 'true');
frame.style.cssText = 'position:fixed;width:0;height:0;border:0;opacity:0;pointer-events:none';
document.documentElement.appendChild(frame);

const row = (k, v) => {
  const ok = v === true, bad = v === false;
  const mark = ok ? '✅' : bad ? '❌' : '  ';
  return `${mark} ${k.padEnd(20)} ${typeof v === 'object' && v ? JSON.stringify(v) : v}`;
};

addEventListener('message', e => {
  const d = e.data;
  if (!d || !d.__lensingSpike) return;
  const order = ['isSecureContext','crossOriginIsolated','sharedArrayBuffer',
    'gpuInDocument','adapterInDocument','deviceInDocument','documentError','adapterInfo',
    'workerSpawn','gpuInWorker','adapterInWorker','deviceInWorker','workerError'];
  const lines = order.filter(k => k in d).map(k => row(k, d[k]));
  panel.textContent = `Lensing spike 12.1 — ${location.hostname}\n${'-'.repeat(40)}\n`
    + lines.join('\n')
    + `\n${'-'.repeat(40)}\nVERDICT: `
    + (d.deviceInWorker ? 'WebGPU works in worker-in-iframe ✅'
      : d.deviceInDocument ? 'iframe OK, WORKER FAILED ⚠️'
      : 'WebGPU unavailable — WASM fallback ❌');
  console.log('[lensing spike]', d);
}, false);
