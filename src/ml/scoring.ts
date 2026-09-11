export type Vector = Float32Array;

export const DEFAULT_STRICTNESS = 0.18;

/** Usable score band measured in spec.md §12.2; scores never approach 1. */
export const STRICTNESS_MIN = 0.02;
export const STRICTNESS_MAX = 0.3;

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

/**
 * Below this, a post counts as short. Measured in spec.md §12.2: on-topic posts
 * score 0.096 when short and 0.233 when long, so one flat threshold cannot
 * serve both.
 */
export const FULL_LENGTH_CHARS = 200;

/** Default extra bar for a post of no length at all. 0 disables the penalty. */
export const DEFAULT_SHORT_PENALTY = 0.8;
export const SHORT_PENALTY_MAX = 2;

/**
 * Short posts must clear a higher bar. Their scores are low whatever the
 * subject, so a short post that still scores well really is on topic — and a
 * three-word post that does not is cheap to lose.
 */
export function thresholdFor(
  strictness: number,
  chars: number,
  penalty: number = DEFAULT_SHORT_PENALTY,
): number {
  if (chars >= FULL_LENGTH_CHARS) return strictness;
  const clamped = Math.min(SHORT_PENALTY_MAX, Math.max(0, penalty));
  const shortness = 1 - Math.max(0, chars) / FULL_LENGTH_CHARS;
  return strictness * (1 + clamped * shortness);
}

export function passes(
  score: number,
  strictness: number,
  chars: number,
  penalty?: number,
): boolean {
  return score >= thresholdFor(strictness, chars, penalty);
}

/** Maps a 0..1 slider position onto the measured usable band. */
export function strictnessFromSlider(position: number): number {
  const clamped = Math.min(1, Math.max(0, position));
  return STRICTNESS_MIN + clamped * (STRICTNESS_MAX - STRICTNESS_MIN);
}

export function sliderFromStrictness(strictness: number): number {
  const span = STRICTNESS_MAX - STRICTNESS_MIN;
  return Math.min(1, Math.max(0, (strictness - STRICTNESS_MIN) / span));
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
