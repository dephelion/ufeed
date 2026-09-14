import browser from 'webextension-polyfill';
import { forCurrentModel, normalizeFeedback, type Feedback } from './feedback';

const KEY = 'feedback';

export async function loadFeedback(): Promise<Feedback> {
  const stored = await browser.storage.local.get(KEY);
  const found = normalizeFeedback(stored[KEY]);
  const usable = forCurrentModel(found);
  if (usable !== found) await saveFeedback(usable);
  return usable;
}

export async function saveFeedback(next: Feedback): Promise<void> {
  await browser.storage.local.set({ [KEY]: next });
}

export async function clearFeedback(): Promise<void> {
  await browser.storage.local.remove(KEY);
}

/**
 * Without this a feed tab keeps the corrections it loaded at startup, and the
 * next thumb writes that stale copy back over a clear or an import.
 */
export function onFeedbackChanged(fn: (feedback: Feedback) => void): () => void {
  const listener = (
    changes: Record<string, browser.Storage.StorageChange>,
    area: string,
  ) => {
    if (area !== 'local' || !changes[KEY]) return;
    fn(forCurrentModel(normalizeFeedback(changes[KEY].newValue)));
  };
  browser.storage.onChanged.addListener(listener);
  return () => browser.storage.onChanged.removeListener(listener);
}
