import { STRICTNESS_STEPS } from './models';

export type Vector = Float32Array;

export function cosine(a: Vector, b: Vector): number {
  if (a.length !== b.length) throw new Error(`vector length ${a.length} vs ${b.length}`);
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i]! * b[i]!;
  return dot;
}

export interface Match {
  score: number;
  /** Index of the closest topic line; -1 when there are no lines. */
  topic: number;
}

/** A match, plus the rating that overrides it when a rated post is near-identical. */
export interface RatedMatch extends Match {
  rating: boolean | undefined;
}

/** Highest similarity to any topic, and the line that gave it. */
export function bestMatch(post: Vector, topics: readonly Vector[]): Match {
  let best: Match = { score: -1, topic: -1 };
  topics.forEach((topic, i) => {
    const score = cosine(post, topic);
    if (score > best.score) best = { score, topic: i };
  });
  return best;
}

export function normalize(v: Vector): Vector {
  let sum = 0;
  for (let i = 0; i < v.length; i++) sum += v[i]! * v[i]!;
  const mag = Math.sqrt(sum);
  if (mag === 0) return v;
  const out = new Float32Array(v.length);
  for (let i = 0; i < v.length; i++) out[i] = v[i]! / mag;
  return out;
}

/**
 * Settings store the step, not the score: unrelated text scores 0.74 with this
 * model and 0.00 with a symmetric one, so a stored score would mean something
 * different the moment the model changes.
 */
export const MAX_STRICTNESS = STRICTNESS_STEPS.length - 1;

/** Anything that is not a step on the scale lands on the nearest one. */
export function clampStrictness(step: number): number {
  if (!Number.isFinite(step)) return 0;
  return Math.min(MAX_STRICTNESS, Math.max(0, Math.round(step)));
}

export function thresholdForStrictness(step: number): number {
  return STRICTNESS_STEPS[clampStrictness(step)]!.threshold;
}

/**
 * Roughly how much of a feed this step leaves visible, from the 205 labelled
 * posts in wiki-llm/model.md. One sample, one feed: a hint, not a promise.
 */
export function feedShownAt(step: number): number {
  return STRICTNESS_STEPS[clampStrictness(step)]!.shown;
}

/**
 * Width of the uncertain strip below the threshold. Below it nothing was wanted
 * across 125 observations; inside it, 7% was. See wiki-llm/model.md.
 */
export const PEEK_BAND = 0.01;

export type Verdict = 'show' | 'peek' | 'blur';

/**
 * A rating overrides the topic score only for a near-identical post: the closest
 * rating at or above `near`, or undefined. See wiki-llm/model.md.
 */
export function ratingNear(
  post: Vector,
  liked: readonly Vector[],
  disliked: readonly Vector[],
  near: number,
): boolean | undefined {
  let best = near;
  let rating: boolean | undefined;
  for (const [vectors, liking] of [
    [liked, true],
    [disliked, false],
  ] as const) {
    for (const v of vectors) {
      const s = cosine(post, v);
      if (s >= best) {
        best = s;
        rating = liking;
      }
    }
  }
  return rating;
}

export interface Rated {
  liked: readonly Vector[];
  disliked: readonly Vector[];
}

/**
 * Every line's ratings, checked together: an off-topic post's best line is a
 * near-tie, so a near-copy can land on a different line than the rated post did.
 */
export function pooled(lines: readonly Rated[]): Rated {
  return {
    liked: lines.flatMap((line) => line.liked),
    disliked: lines.flatMap((line) => line.disliked),
  };
}

/** Verdict from the strictness threshold. */
export function verdictAt(score: number, threshold: number): Verdict {
  if (score >= threshold) return 'show';
  return score >= threshold - PEEK_BAND ? 'peek' : 'blur';
}
