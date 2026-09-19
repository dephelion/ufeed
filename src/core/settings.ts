import browser from 'webextension-polyfill';
import { DEFAULT_STRICTNESS } from '../ml/models';
import { clampStrictness } from '../ml/scoring';

export interface Settings {
  enabled: boolean;
  topics: string[];
  /** Step 0..10, not a score: scores differ per model. */
  strictness: number;
  showScores: boolean;
  /** Blur media posts carrying too little text to judge against the topics. */
  blurThinMedia: boolean;
  /** Let thumbed posts decide their near-copies. Off leaves scoring untouched. */
  tuneFromFeedback: boolean;
  /** Blur posts the model cannot read. Off skips detection entirely. */
  blurOtherLanguages: boolean;
  /** Shrink a blurred post to a thin row instead of leaving it full height. */
  collapseBlurred: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  enabled: true,
  topics: [],
  strictness: DEFAULT_STRICTNESS,
  showScores: false,
  blurThinMedia: false,
  tuneFromFeedback: false,
  blurOtherLanguages: true,
  collapseBlurred: true,
};

/**
 * Stored JSON and backup files outlive the shape that wrote them, and a hand-edited
 * backup can hold anything. A field of the wrong type falls back to its default;
 * `strictness` must also be a step on the 0..10 scale, not the old 0..1 slider.
 */
export function withDefaults(partial: Partial<Settings> | undefined): Settings {
  const merged: Settings = { ...DEFAULT_SETTINGS };
  for (const key of Object.keys(DEFAULT_SETTINGS) as (keyof Settings)[]) {
    const value: unknown = partial?.[key];
    if (sameType(value, DEFAULT_SETTINGS[key]))
      (merged as Record<keyof Settings, unknown>)[key] = value;
  }
  const stored = partial?.strictness;
  merged.strictness =
    typeof stored === 'number' && Number.isInteger(stored)
      ? clampStrictness(stored)
      : DEFAULT_STRICTNESS;
  return merged;
}

const sameType = (value: unknown, fallback: unknown): boolean =>
  Array.isArray(fallback)
    ? Array.isArray(value) && value.every((item) => typeof item === 'string')
    : typeof value === typeof fallback;

/**
 * On, with nothing to do. It is the one inactive state that is not a choice the
 * reader made, so it is the only one worth interrupting them about: everything
 * looks installed and nothing happens.
 */
export function needsTopics(settings: Settings): boolean {
  return settings.enabled && settings.topics.length === 0;
}

export function isActive(settings: Settings): boolean {
  return settings.enabled && settings.topics.length > 0;
}

/** One topic per line; blanks and duplicates dropped. */
export function parseTopics(raw: string): string[] {
  const seen = new Set<string>();
  for (const line of raw.split('\n')) {
    const topic = line.trim();
    if (topic !== '') seen.add(topic);
  }
  return [...seen];
}

export function topicsToText(topics: readonly string[]): string {
  return topics.join('\n');
}

export function topicsEqual(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((topic, i) => topic === b[i]);
}

const KEY = 'settings';

export async function loadSettings(): Promise<Settings> {
  const stored = await browser.storage.local.get(KEY);
  return withDefaults(stored[KEY] as Partial<Settings> | undefined);
}

export async function saveSettings(patch: Partial<Settings>): Promise<Settings> {
  const next = { ...(await loadSettings()), ...patch };
  await browser.storage.local.set({ [KEY]: next });
  return next;
}

export function onSettingsChanged(fn: (settings: Settings) => void): () => void {
  const listener = (
    changes: Record<string, browser.Storage.StorageChange>,
    area: string,
  ) => {
    if (area !== 'local' || !changes[KEY]) return;
    fn(withDefaults(changes[KEY].newValue as Partial<Settings> | undefined));
  };
  browser.storage.onChanged.addListener(listener);
  return () => browser.storage.onChanged.removeListener(listener);
}
