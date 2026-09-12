import { MODEL } from './models';

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
 * Settings store the slider position, not the score: unrelated text scores 0.74
 * with this model and 0.00 with a symmetric one, so a stored score would mean
 * something different the moment the model changes.
 */
export interface Band {
  min: number;
  max: number;
}

export const DEFAULT_BAND: Band = { min: MODEL.bandMin, max: MODEL.bandMax };

export function strictnessFromPosition(
  position: number,
  band: Band = DEFAULT_BAND,
): number {
  return band.min + clamp01(position) * (band.max - band.min);
}

export function positionFromStrictness(
  strictness: number,
  band: Band = DEFAULT_BAND,
): number {
  const span = band.max - band.min;
  return span === 0 ? 0 : clamp01((strictness - band.min) / span);
}

/**
 * Width of the uncertain strip below the threshold. Below it nothing was wanted
 * across 125 observations; inside it, 7% was. See wiki-llm/model.md.
 */
export const PEEK_BAND = 0.01;

export type Verdict = 'show' | 'peek' | 'blur';

/** Model-relative, never a fraction of the slider: the strip is a property of e5. */
export function verdictFor(
  score: number,
  position: number,
  band: Band = DEFAULT_BAND,
): Verdict {
  const threshold = strictnessFromPosition(position, band);
  if (score >= threshold) return 'show';
  return score >= threshold - PEEK_BAND ? 'peek' : 'blur';
}

/**
 * Roughly how much of a feed survives a threshold, from the 205 labelled posts
 * in wiki-llm/model.md. One sample, one topic: a hint, not a promise.
 */
export function estimateFeedShown(threshold: number): number {
  const curve: readonly (readonly [number, number])[] = [
    [0.76, 0.65],
    [0.768, 0.58],
    [0.782, 0.4],
    [0.796, 0.25],
    [0.8, 0.2],
    [0.81, 0.14],
    [0.817, 0.07],
    [0.824, 0.04],
    [0.838, 0.0],
  ];
  if (threshold <= curve[0]![0]) return curve[0]![1];
  for (let i = 1; i < curve.length; i++) {
    const [x1, y1] = curve[i]!;
    const [x0, y0] = curve[i - 1]!;
    if (threshold <= x1) return y0 + ((threshold - x0) / (x1 - x0)) * (y1 - y0);
  }
  return 0;
}
