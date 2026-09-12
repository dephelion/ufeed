/**
 * Corrections the user made to the model's verdicts, as embeddings, kept per
 * topic line. Pure: the storage half lives in feedback-storage.ts.
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
  byTopic: Record<string, Rating[]>;
}

export interface TopicCorrections {
  liked: number[][];
  disliked: number[][];
}

export const EMPTY_FEEDBACK: Feedback = { byTopic: {} };

/** Oldest corrections fall off first; the query should follow current taste. */
export const MAX_PER_CLASS = 50;

/**
 * Storage outlives the shape that wrote it. Anything that is not a Rating is
 * dropped rather than trusted: corrections are cheap to give again, and a stale
 * shape took the whole content script down with it.
 */
export function normalizeFeedback(value: unknown): Feedback {
  const raw = isRecord(value) ? value['byTopic'] : undefined;
  if (!isRecord(raw)) return EMPTY_FEEDBACK;
  const byTopic: Record<string, Rating[]> = {};
  for (const [topic, list] of Object.entries(raw)) {
    if (!Array.isArray(list)) continue;
    const ratings = list.filter(isRating);
    if (ratings.length > 0) byTopic[topic] = ratings;
  }
  return { byTopic };
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
  for (const [topic, ratings] of Object.entries(feedback.byTopic)) {
    const hit = ratings.find((r) => r.key === key);
    if (hit) return { topic, liked: hit.liked };
  }
  return undefined;
}

/**
 * Rating a post again un-rates it; rating it the other way flips it. Without
 * this a held click stacks copies of one post into the centroid and a
 * mind-change leaves it pulling both ways at once.
 */
export function rate(
  feedback: Feedback,
  topic: string,
  key: string,
  vector: number[],
  liked: boolean,
): Feedback {
  if (topic === '' || key === '') return feedback;
  const existing = findRating(feedback, key);
  if (existing) {
    const cleared = remove(feedback, key);
    return existing.liked === liked
      ? cleared
      : append(cleared, existing.topic, { key, vector, liked });
  }
  return vector.length === 0 ? feedback : append(feedback, topic, { key, vector, liked });
}

export function remove(feedback: Feedback, key: string): Feedback {
  const byTopic: Record<string, Rating[]> = {};
  for (const [topic, ratings] of Object.entries(feedback.byTopic)) {
    const kept = ratings.filter((r) => r.key !== key);
    if (kept.length > 0) byTopic[topic] = kept;
  }
  return { byTopic };
}

function append(feedback: Feedback, topic: string, rating: Rating): Feedback {
  const current = ratingsFor(feedback, topic);
  const sameSide = current.filter((r) => r.liked === rating.liked);
  const drop =
    sameSide.length >= MAX_PER_CLASS
      ? new Set(sameSide.slice(0, sameSide.length - MAX_PER_CLASS + 1).map((r) => r.key))
      : new Set<string>();
  return {
    byTopic: {
      ...feedback.byTopic,
      [topic]: [...current.filter((r) => !drop.has(r.key)), rating],
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
  return { byTopic };
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

export function count(feedback: Feedback): number {
  return Object.values(feedback.byTopic).reduce((n, r) => n + r.length, 0);
}
