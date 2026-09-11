const out = {
  href: location.href,
  isSecureContext,
  crossOriginIsolated,
  sharedArrayBuffer: typeof SharedArrayBuffer !== 'undefined',
  gpuInDocument: 'gpu' in navigator
};

const workerProbe = () => new Promise(resolve => {
  try {
    const w = new Worker('worker.js');
    const t = setTimeout(() => { resolve({ workerError: 'timeout' }); w.terminate(); }, 8000);
    w.onmessage = e => { clearTimeout(t); w.terminate(); resolve(e.data); };
    w.onerror = e => { clearTimeout(t); resolve({ workerError: e.message || 'worker onerror' }); };
    w.postMessage('go');
  } catch (e) { resolve({ workerSpawn: false, workerError: String(e.message || e) }); }
});

(async () => {
  try {
    const adapter = out.gpuInDocument ? await navigator.gpu.requestAdapter() : null;
    out.adapterInDocument = !!adapter;
    if (adapter) {
      out.adapterInfo = adapter.info
        ? { vendor: adapter.info.vendor, architecture: adapter.info.architecture,
            device: adapter.info.device, description: adapter.info.description }
        : null;
      out.maxBufferSize = adapter.limits?.maxBufferSize ?? null;
      const device = await adapter.requestDevice();
      out.deviceInDocument = !!device;
      device.destroy?.();
    }
  } catch (e) { out.documentError = String(e && e.message || e); }

  out.workerSpawn = true;
  Object.assign(out, await workerProbe());
  parent.postMessage({ __lensingSpike: true, ...out }, '*');
})();
