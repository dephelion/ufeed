import type { Settings } from '../core/settings';
import {
  MIN_SAMPLE,
  feedShownAt,
  thresholdForFraction,
  thresholdForStrictness,
} from '../ml/scoring';

/** Enough recent scores for a stable quantile, short enough to follow the feed. */
const WINDOW = 300;

/**
 * Owns one recent-score window per topic line and the one decision that needs
 * them: whether a line's cut is an absolute cosine or a quantile of its own scores.
 */
export class ScoreWindow {
  readonly #byLine = new Map<string, number[]>();

  add(line: string, score: number): void {
    const recent = this.#byLine.get(line) ?? [];
    recent.push(score);
    if (recent.length > WINDOW) recent.splice(0, recent.length - WINDOW);
    this.#byLine.set(line, recent);
  }

  /**
   * A corrected line has its own score scale, so its cut is a quantile of what
   * that line scored, or of every line's scores until it has enough of its own.
   */
  cut(settings: Settings, line: string | undefined, corrected: boolean): number {
    const absolute = thresholdForStrictness(settings.strictness);
    if (line === undefined || !corrected) return absolute;
    const own = this.#byLine.get(line) ?? [];
    const sample = own.length >= MIN_SAMPLE ? own : [...this.#byLine.values()].flat();
    return thresholdForFraction(sample, feedShownAt(settings.strictness), absolute);
  }

  /** Drops the windows of lines the user has removed or rewritten. */
  keepOnly(lines: readonly string[]): void {
    for (const line of this.#byLine.keys())
      if (!lines.includes(line)) this.#byLine.delete(line);
  }

  sizeOf(line: string): number {
    return this.#byLine.get(line)?.length ?? 0;
  }
}
