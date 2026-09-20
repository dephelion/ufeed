import { DEFAULT_MODEL, DEFAULT_STRICTNESS, isModelKey, type ModelKey } from './models';
import { clampStrictness } from './scoring';

export interface Settings {
  enabled: boolean;
  topics: string[];
  /** Which model scores the feed. Changing it restarts the engine. */
  model: ModelKey;
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
  model: DEFAULT_MODEL,
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
  // A model this build does not have is not a model: a stale or hand-edited key
  // would otherwise reach modelFor() and silently score with the wrong scale.
  if (!isModelKey(merged.model)) merged.model = DEFAULT_MODEL;
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
