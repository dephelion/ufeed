import { MODEL } from '../ml/models';

export interface Settings {
  enabled: boolean;
  topics: string[];
  /** Slider position 0..1, not a score: scores differ per model. */
  strictness: number;
  /** Score the slider maps onto at 0% and 100%. */
  bandMin: number;
  bandMax: number;
  disabledHosts: string[];
  alwaysKeep: string[];
  alwaysBlur: string[];
  showScores: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  enabled: true,
  topics: [],
  strictness: MODEL.defaultPosition,
  bandMin: MODEL.bandMin,
  bandMax: MODEL.bandMax,
  disabledHosts: [],
  alwaysKeep: [],
  alwaysBlur: [],
  showScores: false,
};

export function withDefaults(partial: Partial<Settings> | undefined): Settings {
  return { ...DEFAULT_SETTINGS, ...partial };
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

/** Guards against an inverted or collapsed band from the advanced inputs. */
export function usableBand(settings: Settings): { min: number; max: number } {
  const min = Math.min(settings.bandMin, settings.bandMax);
  const max = Math.max(settings.bandMin, settings.bandMax);
  return max - min < 0.01 ? { min, max: min + 0.01 } : { min, max };
}
