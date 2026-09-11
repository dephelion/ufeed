/**
 * e5-small-v2, chosen by measurement over all-MiniLM-L6-v2 and bge-small-en-v1.5
 * on 205 labelled posts: AUC 0.881 vs 0.826 and 0.817, and it shows 20% of a feed
 * to keep 80% of what you want where the others show a third. See spec.md §12.2.
 *
 * It is a retrieval model, so the topic and the post are tagged differently: the
 * topic is the query, the post is the passage.
 */
export const MODEL = {
  id: 'Xenova/e5-small-v2',
  label: 'e5-small-v2',
  /** Usable threshold band. Unrelated text sits near 0.74, not near zero. */
  bandMin: 0.74,
  bandMax: 0.88,
  defaultPosition: 0.43,
  /** Self-check bounds; a miscomputing backend collapses the gap. */
  probeMinNear: 0.78,
  probeMinGap: 0.06,
} as const;

export const formatTopic = (topic: string): string => `query: ${topic}`;
export const formatPost = (text: string): string => `passage: ${text}`;

/** Probe pair for the backend self-check: one related, one not. */
export const PROBE = {
  anchor: 'software engineering',
  near: 'writing code and building software systems',
  far: 'a recipe for chocolate cake with butter and eggs',
} as const;
