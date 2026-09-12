import { type Settings, usableBand } from '../core/settings';
import {
  estimateFeedShown,
  strictnessFromPosition,
  thresholdForFraction,
} from '../ml/scoring';

/** Enough recent scores for a stable quantile, short enough to follow the feed. */
const WINDOW = 300;

/**
 * Owns the recent-score window and the one decision that needs it: whether the
 * cut is an absolute cosine or a quantile of what the feed is actually scoring.
 */
export class ScoreWindow {
  readonly #recent: number[] = [];

  add(scores: readonly (number | undefined)[]): void {
    for (const score of scores) if (score !== undefined) this.#recent.push(score);
    if (this.#recent.length > WINDOW) {
      this.#recent.splice(0, this.#recent.length - WINDOW);
    }
  }

  /**
   * A corrected query moves the whole score scale, so a fixed cosine stops
   * meaning anything. Relative only when `adapted` — absolute is better
   * calibrated until then, and never blurs a feed that is entirely on topic.
   */
  cut(settings: Settings, adapted: boolean): number {
    const absolute = strictnessFromPosition(settings.strictness, usableBand(settings));
    if (!adapted) return absolute;
    return thresholdForFraction(this.#recent, estimateFeedShown(absolute), absolute);
  }

  get size(): number {
    return this.#recent.length;
  }
}
