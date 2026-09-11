self.onmessage = async () => {
  const r = { gpuInWorker: typeof navigator !== 'undefined' && 'gpu' in navigator };
  try {
    const adapter = r.gpuInWorker ? await navigator.gpu.requestAdapter() : null;
    r.adapterInWorker = !!adapter;
    if (adapter) {
      const d = await adapter.requestDevice();
      r.deviceInWorker = !!d;
      r.workerAdapterInfo = adapter.info
        ? { vendor: adapter.info.vendor, architecture: adapter.info.architecture }
        : null;
      d.destroy?.();
    }
  } catch (e) { r.workerError = String(e && e.message || e); }
  self.postMessage(r);
};
