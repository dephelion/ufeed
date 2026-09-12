/**
 * Corrections the user made to the model's verdicts, as embeddings. Pure: the
 * storage half lives in feedback-storage.ts so this tests without a browser.
 */
export interface Feedback {
  /** The topic set these corrections were collected against. */
  topics: string[];
  liked: number[][];
  disliked: number[][];
}

export const EMPTY_FEEDBACK: Feedback = { topics: [], liked: [], disliked: [] };

/** Oldest corrections fall off first; the query should follow current taste. */
export const MAX_PER_CLASS = 50;

const sameTopics = (a: readonly string[], b: readonly string[]): boolean =>
  a.length === b.length && a.every((t, i) => t === b[i]);

/**
 * A correction means "not this, for THAT topic". Carrying it to a different
 * topic set applies it to a query it was never about.
 */
export function forTopics(feedback: Feedback, topics: string[]): Feedback {
  return sameTopics(feedback.topics, topics) ? feedback : { ...EMPTY_FEEDBACK, topics };
}

export function record(
  feedback: Feedback,
  topics: string[],
  vector: number[],
  liked: boolean,
): Feedback {
  const base = forTopics(feedback, topics);
  if (vector.length === 0) return base;
  const key = liked ? 'liked' : 'disliked';
  return { ...base, [key]: [...base[key], vector].slice(-MAX_PER_CLASS) };
}

export function count(feedback: Feedback): number {
  return feedback.liked.length + feedback.disliked.length;
}
