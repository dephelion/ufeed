import type { ModelSpec } from './models';

/**
 * Corrections the user made to the model's verdicts, as embeddings, kept per
 * topic line.
 *
 * Per line, not per topic set. Scoring takes the max across lines, so a
 * correction belongs to the line that came closest to claiming the post —
 * and editing one line must not discard what was learned about the others.
 */
export interface Rating {
  /** hashText of the post, so a recycled node or a re-render is the same post. */
  key: string;
  vector: number[];
  liked: boolean;
}

export interface Feedback {
  /** Which model produced these vectors. Another model's are unusable. */
  model: string;
  dim: number;
  byTopic: Record<string, Rating[]>;
}

export interface TopicCorrections {
  liked: number[][];
  disliked: number[][];
}

/** No ratings, and no model: the storage layer stamps what it writes. */
export const EMPTY_FEEDBACK: Feedback = { model: '', dim: 0, byTopic: {} };

export const emptyFor = (spec: ModelSpec): Feedback => ({
  model: spec.id,
  dim: spec.dim,
  byTopic: {},
});

/**
 * Stored corrections predate the stamp, and every install that has any was
 * written by e5-small-v2. Reading the current model's id here instead would
 * relabel them as whatever ships next.
 */
const UNSTAMPED = { model: 'Xenova/e5-small-v2', dim: 384 } as const;

/**
 * Ratings for every model that has any, keyed by model id.
 *
 * Kept apart rather than wiped on a switch: another model's vectors are in
 * another coordinate space and the post text was discarded at rating time, so
 * they can be neither compared nor re-embedded — but they are still perfectly
 * good for the model that made them, and a switch back restores them.
 */
export type FeedbackByModel = Record<string, Feedback>;

export function normalizeStore(value: unknown): FeedbackByModel {
  if (!isRecord(value)) return {};
  // Pre-0.8 shape: one model's ratings at the top level, always e5-small-v2's.
  if ('byTopic' in value) {
    const legacy = normalizeFeedback(value);
    return { [legacy.model]: legacy };
  }
  const store: FeedbackByModel = {};
  for (const [id, stored] of Object.entries(value)) {
    const found = normalizeFeedback(stored);
    if (Object.keys(found.byTopic).length > 0) store[id] = { ...found, model: id };
  }
  return store;
}

/** A model reads only its own ratings; a stamp that disagrees is not usable. */
export function feedbackFor(store: FeedbackByModel, spec: ModelSpec): Feedback {
  const found = store[spec.id];
  return found ? forCurrentModel(found, spec) : emptyFor(spec);
}

export function withFeedback(
  store: FeedbackByModel,
  spec: ModelSpec,
  feedback: Feedback,
): FeedbackByModel {
  return { ...store, [spec.id]: { ...feedback, model: spec.id, dim: spec.dim } };
}

/** Oldest corrections fall off first; the query should follow current taste. */
export const MAX_PER_CLASS = 50;

/**
 * Storage outlives the shape that wrote it. Anything that is not a Rating is
 * dropped rather than trusted: corrections are cheap to give again, and a stale
 * shape took the whole content script down with it.
 */
export function normalizeFeedback(value: unknown): Feedback {
  const record = isRecord(value) ? value : {};
  const model = typeof record['model'] === 'string' ? record['model'] : UNSTAMPED.model;
  const dim = typeof record['dim'] === 'number' ? record['dim'] : UNSTAMPED.dim;
  const raw = record['byTopic'];
  if (!isRecord(raw)) return { model, dim, byTopic: {} };
  const byTopic: Record<string, Rating[]> = {};
  for (const [topic, list] of Object.entries(raw)) {
    if (!Array.isArray(list)) continue;
    const ratings = list.filter(isRating);
    if (ratings.length > 0) byTopic[topic] = ratings;
  }
  return { model, dim, byTopic };
}

/**
 * Vectors from another model are in another coordinate space, and the text they
 * came from is long gone, so there is nothing to re-embed. A mismatched stamp
 * reads as no ratings for this model; the stored blob is not touched.
 */
export function forCurrentModel(feedback: Feedback, spec: ModelSpec): Feedback {
  return feedback.model === spec.id && feedback.dim === spec.dim
    ? feedback
    : emptyFor(spec);
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

function isRating(v: unknown): v is Rating {
  return (
    isRecord(v) &&
    typeof v['key'] === 'string' &&
    typeof v['liked'] === 'boolean' &&
    Array.isArray(v['vector']) &&
    v['vector'].every((n) => typeof n === 'number')
  );
}

export function ratingsFor(feedback: Feedback, topic: string): readonly Rating[] {
  return feedback.byTopic[topic] ?? [];
}

/** A post is rated once, wherever it was filed. Lets a re-click find it. */
export function findRating(
  feedback: Feedback,
  key: string,
): { topic: string; liked: boolean } | undefined {
  const hit = find(feedback, key);
  return hit && { topic: hit.topic, liked: hit.rating.liked };
}

function find(
  feedback: Feedback,
  key: string,
): { topic: string; rating: Rating } | undefined {
  for (const [topic, ratings] of Object.entries(feedback.byTopic)) {
    const rating = ratings.find((r) => r.key === key);
    if (rating) return { topic, rating };
  }
  return undefined;
}

/**
 * Rating a post again un-rates it; rating it the other way flips it, keeping the
 * stored vector: a re-click never reaches the engine, so it passes none.
 */
export function rate(
  feedback: Feedback,
  topic: string,
  key: string,
  vector: number[],
  liked: boolean,
): Feedback {
  if (topic === '' || key === '') return feedback;
  const existing = find(feedback, key);
  if (existing) {
    const cleared = remove(feedback, key);
    return existing.rating.liked === liked
      ? cleared
      : append(cleared, existing.topic, { key, vector: existing.rating.vector, liked });
  }
  return vector.length === 0 ? feedback : append(feedback, topic, { key, vector, liked });
}

export function remove(feedback: Feedback, key: string): Feedback {
  const byTopic: Record<string, Rating[]> = {};
  for (const [topic, ratings] of Object.entries(feedback.byTopic)) {
    const kept = ratings.filter((r) => r.key !== key);
    if (kept.length > 0) byTopic[topic] = kept;
  }
  return { ...feedback, byTopic };
}

/** Oldest first off each side, so a restored backup obeys the cap as thumbs do. */
export function capped(ratings: readonly Rating[]): Rating[] {
  const keep = new Set<Rating>();
  for (const liked of [true, false]) {
    for (const rating of ratings.filter((r) => r.liked === liked).slice(-MAX_PER_CLASS))
      keep.add(rating);
  }
  return ratings.filter((r) => keep.has(r));
}

function append(feedback: Feedback, topic: string, rating: Rating): Feedback {
  return {
    ...feedback,
    byTopic: {
      ...feedback.byTopic,
      [topic]: capped([...ratingsFor(feedback, topic), rating]),
    },
  };
}

/** Drops corrections for lines the user has removed or rewritten. */
export function forTopics(feedback: Feedback, topics: readonly string[]): Feedback {
  const byTopic: Record<string, Rating[]> = {};
  for (const topic of topics) {
    const existing = feedback.byTopic[topic];
    if (existing) byTopic[topic] = existing;
  }
  return { ...feedback, byTopic };
}

/** The protocol shape: two lists of raw vectors, per topic. */
export function correctionsFor(feedback: Feedback, topic: string): TopicCorrections {
  const ratings = ratingsFor(feedback, topic);
  return {
    liked: ratings.filter((r) => r.liked).map((r) => r.vector),
    disliked: ratings.filter((r) => !r.liked).map((r) => r.vector),
  };
}

export function countFor(feedback: Feedback, topic: string): number {
  return ratingsFor(feedback, topic).length;
}

export interface Counts {
  up: number;
  down: number;
  total: number;
}

export function counts(feedback: Feedback): Counts {
  let up = 0;
  let down = 0;
  for (const ratings of Object.values(feedback.byTopic)) {
    for (const rating of ratings) {
      if (rating.liked) up += 1;
      else down += 1;
    }
  }
  return { up, down, total: up + down };
}

export function count(feedback: Feedback): number {
  return Object.values(feedback.byTopic).reduce((n, r) => n + r.length, 0);
}
