import browser from 'webextension-polyfill';

/** Discard model files, then restart all extension contexts without touching user data. */
export async function restartExtension(): Promise<void> {
  if (typeof caches === 'undefined') throw new Error('model cache is unavailable');
  await caches.delete('transformers-cache');
  browser.runtime.reload();
}
