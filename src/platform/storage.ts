import browser from 'webextension-polyfill';
import { forCurrentModel, normalizeFeedback, type Feedback } from '../core/feedback';
import { withDefaults, type Settings } from '../core/settings';
import type { FeedbackStore } from '../feed/ports';

/** Two `storage.local` keys and no others; see wiki-llm/architecture.md §Persisted state. */
const SETTINGS = 'settings';

export async function loadSettings(): Promise<Settings> {
  const stored = await browser.storage.local.get(SETTINGS);
  return withDefaults(stored[SETTINGS] as Partial<Settings> | undefined);
}

export async function saveSettings(patch: Partial<Settings>): Promise<Settings> {
  const next = { ...(await loadSettings()), ...patch };
  await browser.storage.local.set({ [SETTINGS]: next });
  return next;
}

export function onSettingsChanged(fn: (settings: Settings) => void): () => void {
  const listener = (
    changes: Record<string, browser.Storage.StorageChange>,
    area: string,
  ) => {
    if (area !== 'local' || !changes[SETTINGS]) return;
    fn(withDefaults(changes[SETTINGS].newValue as Partial<Settings> | undefined));
  };
  browser.storage.onChanged.addListener(listener);
  return () => browser.storage.onChanged.removeListener(listener);
}

const FEEDBACK = 'feedback';

export async function loadFeedback(): Promise<Feedback> {
  const stored = await browser.storage.local.get(FEEDBACK);
  const found = normalizeFeedback(stored[FEEDBACK]);
  const usable = forCurrentModel(found);
  if (usable !== found) await saveFeedback(usable);
  return usable;
}

export async function saveFeedback(next: Feedback): Promise<void> {
  await browser.storage.local.set({ [FEEDBACK]: next });
}

export async function clearFeedback(): Promise<void> {
  await browser.storage.local.remove(FEEDBACK);
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
    if (area !== 'local' || !changes[FEEDBACK]) return;
    fn(forCurrentModel(normalizeFeedback(changes[FEEDBACK].newValue)));
  };
  browser.storage.onChanged.addListener(listener);
  return () => browser.storage.onChanged.removeListener(listener);
}

export const feedbackStore: FeedbackStore = {
  load: loadFeedback,
  save: saveFeedback,
  onChange: onFeedbackChanged,
};
