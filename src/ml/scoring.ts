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
export function strictnessFromPosition(position: number): number {
  return MODEL.bandMin + clamp01(position) * (MODEL.bandMax - MODEL.bandMin);
}

export function positionFromStrictness(strictness: number): number {
  const span = MODEL.bandMax - MODEL.bandMin;
  return span === 0 ? 0 : clamp01((strictness - MODEL.bandMin) / span);
}

export function passes(score: number, position: number): boolean {
  return score >= strictnessFromPosition(position);
}
