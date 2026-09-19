import browser from 'webextension-polyfill';
import {
  feedbackFor,
  normalizeStore,
  withFeedback,
  type Feedback,
} from '../core/feedback';
import { modelFor, type ModelKey, type ModelSpec } from '../core/models';
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

const readStore = async () =>
  normalizeStore((await browser.storage.local.get(FEEDBACK))[FEEDBACK]);

export async function loadFeedback(spec: ModelSpec): Promise<Feedback> {
  return feedbackFor(await readStore(), spec);
}

/** Read-modify-write: one model's thumbs must not drop another model's. */
export async function saveFeedback(spec: ModelSpec, next: Feedback): Promise<void> {
  const store = withFeedback(await readStore(), spec, next);
  await browser.storage.local.set({ [FEEDBACK]: store });
}

/** No spec clears every model's ratings, which is what "start over" means. */
export async function clearFeedback(spec?: ModelSpec): Promise<void> {
  if (!spec) {
    await browser.storage.local.remove(FEEDBACK);
    return;
  }
  const store = await readStore();
  delete store[spec.id];
  await browser.storage.local.set({ [FEEDBACK]: store });
}

/**
 * Without this a feed tab keeps the corrections it loaded at startup, and the
 * next thumb writes that stale copy back over a clear or an import.
 */
export function onFeedbackChanged(
  spec: () => ModelSpec,
  fn: (feedback: Feedback) => void,
): () => void {
  const listener = (
    changes: Record<string, browser.Storage.StorageChange>,
    area: string,
  ) => {
    if (area !== 'local' || !changes[FEEDBACK]) return;
    // Synchronously: a tab must hear about a clear elsewhere before its next
    // thumb writes a stale copy back over it.
    fn(feedbackFor(normalizeStore(changes[FEEDBACK].newValue), spec()));
  };
  browser.storage.onChanged.addListener(listener);
  return () => browser.storage.onChanged.removeListener(listener);
}

/**
 * The model is read per call rather than captured, so a switch changes which
 * ratings this store reads and writes without rebuilding what holds it. The
 * caller owns the answer — it already tracks settings — which keeps every read
 * here synchronous.
 */
export function feedbackStoreFor(model: () => ModelKey): FeedbackStore {
  const spec = () => modelFor(model());
  return {
    load: () => loadFeedback(spec()),
    save: (feedback) => saveFeedback(spec(), feedback),
    onChange: (fn) => onFeedbackChanged(spec, fn),
  };
}
