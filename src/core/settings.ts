import { DEFAULT_STRICTNESS } from '../ml/models';
import { clampStrictness } from '../ml/scoring';

export interface Settings {
  enabled: boolean;
  topics: string[];
  /** Step 0..10, not a score: scores differ per model. */
  strictness: number;
  disabledHosts: string[];
  alwaysKeep: string[];
  alwaysBlur: string[];
  showScores: boolean;
  /** Blur media posts carrying too little text to judge against the topics. */
  blurThinMedia: boolean;
  /** Apply thumbed corrections to the topic vectors. Off leaves scoring untouched. */
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
  disabledHosts: [],
  alwaysKeep: [],
  alwaysBlur: [],
  showScores: false,
  blurThinMedia: false,
  tuneFromFeedback: false,
  blurOtherLanguages: false,
  collapseBlurred: false,
};

/**
 * Spreading defaults over stored JSON checks nothing, and `strictness` outlived
 * a scale change: a stored 0.35 from the old 0..1 slider is step 0 here, which
 * would silently unblur a feed. Anything off the scale lands on the nearest step.
 */
export function withDefaults(partial: Partial<Settings> | undefined): Settings {
  const merged = { ...DEFAULT_SETTINGS, ...partial };
  const stored = partial?.strictness;
  merged.strictness =
    typeof stored === 'number' && Number.isInteger(stored)
      ? clampStrictness(stored)
      : DEFAULT_STRICTNESS;
  return merged;
}

/**
 * On, welcome on this host, and with nothing to do. It is the one inactive state
 * that is not a choice the reader made, so it is the only one worth interrupting
 * them about: everything looks installed and nothing happens.
 */
export function needsTopics(settings: Settings, hostname: string): boolean {
  return (
    settings.enabled &&
    settings.topics.length === 0 &&
    !settings.disabledHosts.includes(hostname)
  );
}

export function isActiveOn(settings: Settings, hostname: string): boolean {
  return (
    settings.enabled &&
    settings.topics.length > 0 &&
    !settings.disabledHosts.includes(hostname)
  );
}

/** Overrides win over the model; empty terms never match. */
export function overrideFor(
  settings: Settings,
  text: string,
): 'keep' | 'blur' | undefined {
  const haystack = text.toLowerCase();
  const hit = (terms: string[]) =>
    terms.some((t) => t.trim() !== '' && haystack.includes(t.toLowerCase()));
  if (hit(settings.alwaysKeep)) return 'keep';
  if (hit(settings.alwaysBlur)) return 'blur';
  return undefined;
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
