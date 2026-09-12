/**
 * Corrections the user made to the model's verdicts, as embeddings, kept per
 * topic line. Pure: the storage half lives in feedback-storage.ts.
 *
 * Per line, not per topic set. Scoring takes the max across lines, so a
 * correction belongs to the line that came closest to claiming the post —
 * and editing one line must not discard what was learned about the others.
 */
export interface TopicCorrections {
  liked: number[][];
  disliked: number[][];
}

export interface Feedback {
  byTopic: Record<string, TopicCorrections>;
}

export const EMPTY_FEEDBACK: Feedback = { byTopic: {} };
const NONE: TopicCorrections = { liked: [], disliked: [] };

/** Oldest corrections fall off first; the query should follow current taste. */
export const MAX_PER_CLASS = 50;

export function correctionsFor(feedback: Feedback, topic: string): TopicCorrections {
  return feedback.byTopic[topic] ?? NONE;
}

/** Drops corrections for lines the user has removed or rewritten. */
export function forTopics(feedback: Feedback, topics: readonly string[]): Feedback {
  const kept: Record<string, TopicCorrections> = {};
  for (const topic of topics) {
    const existing = feedback.byTopic[topic];
    if (existing) kept[topic] = existing;
  }
  return { byTopic: kept };
}

export function record(
  feedback: Feedback,
  topic: string,
  vector: number[],
  liked: boolean,
): Feedback {
  if (vector.length === 0 || topic === '') return feedback;
  const current = correctionsFor(feedback, topic);
  const key = liked ? 'liked' : 'disliked';
  return {
    byTopic: {
      ...feedback.byTopic,
      [topic]: { ...current, [key]: [...current[key], vector].slice(-MAX_PER_CLASS) },
    },
  };
}

export function countFor(feedback: Feedback, topic: string): number {
  const c = correctionsFor(feedback, topic);
  return c.liked.length + c.disliked.length;
}

export function count(feedback: Feedback): number {
  return Object.keys(feedback.byTopic).reduce((n, t) => n + countFor(feedback, t), 0);
}
