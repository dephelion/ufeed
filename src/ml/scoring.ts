import { STRICTNESS_STEPS } from './models';

export type Vector = Float32Array;

export function cosine(a: Vector, b: Vector): number {
  if (a.length !== b.length) throw new Error(`vector length ${a.length} vs ${b.length}`);
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i]! * b[i]!;
  return dot;
}

/** Highest similarity to any topic. Cost is independent of topic count. */
export function scoreAgainstTopics(post: Vector, topics: readonly Vector[]): number {
  let best = -1;
  for (const topic of topics) {
    const s = cosine(post, topic);
    if (s > best) best = s;
  }
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

const clamp01 = (n: number): number => Math.min(1, Math.max(0, n));

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

/** Share of what survives this step that was not wanted after all. */
export function junkShownAt(step: number): number {
  return STRICTNESS_STEPS[clampStrictness(step)]!.junk;
}

/**
 * Width of the uncertain strip below the threshold. Below it nothing was wanted
 * across 125 observations; inside it, 7% was. See wiki-llm/model.md.
 */
export const PEEK_BAND = 0.01;

export type Verdict = 'show' | 'peek' | 'blur';

/**
 * Rocchio relevance feedback. Measured on 205 posts with the feedback held out:
 * AUC 0.881 -> 0.936 at 32 corrections. See wiki-llm/model.md.
 */
export const ROCCHIO = { beta: 0.6, gamma: 0.4 } as const;

export function applyFeedback(
  topic: Vector,
  liked: readonly Vector[],
  disliked: readonly Vector[],
): Vector {
  if (liked.length === 0 && disliked.length === 0) return topic;
  const out = new Float32Array(topic.length);
  const add = centroid(liked, topic.length);
  const sub = centroid(disliked, topic.length);
  for (let i = 0; i < topic.length; i++) {
    out[i] = topic[i]! + ROCCHIO.beta * add[i]! - ROCCHIO.gamma * sub[i]!;
  }
  return normalize(out);
}

function centroid(vectors: readonly Vector[], dims: number): Vector {
  const out = new Float32Array(dims);
  if (vectors.length === 0) return out;
  for (const v of vectors)
    for (let i = 0; i < dims; i++) out[i]! += v[i]! / vectors.length;
  return out;
}

/** Verdict from an already-resolved threshold, which may be absolute or relative. */
export function verdictAt(score: number, threshold: number): Verdict {
  if (score >= threshold) return 'show';
  return score >= threshold - PEEK_BAND ? 'peek' : 'blur';
}

/**
 * Feedback moves the query vector, which moves the whole score scale with it —
 * a fixed cosine stops meaning anything. Measured: recall fell to 11% when the
 * threshold was left absolute. Below MIN_SAMPLE the quantile is noise, so the
 * absolute threshold stands.
 */
export const MIN_SAMPLE = 30;

export function thresholdForFraction(
  scores: readonly number[],
  fraction: number,
  fallback: number,
): number {
  if (scores.length < MIN_SAMPLE) return fallback;
  const sorted = [...scores].sort((a, b) => a - b);
  const index = Math.floor(sorted.length * (1 - clamp01(fraction)));
  return sorted[Math.min(sorted.length - 1, Math.max(0, index))]!;
}
