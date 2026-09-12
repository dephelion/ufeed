/**
 * e5-small-v2, chosen by measurement over all-MiniLM-L6-v2 and bge-small-en-v1.5
 * on 205 labelled posts: AUC 0.881 vs 0.826 and 0.817, and it shows 20% of a feed
 * to keep 80% of what you want where the others show a third. See wiki-llm/model.md.
 *
 * It is a retrieval model, so the topic and the post are tagged differently: the
 * topic is the query, the post is the passage.
 */
export const MODEL = {
  id: 'Xenova/e5-small-v2',
  label: 'e5-small-v2',
  /**
   * The only language it reads. Text in any other scores somewhere in the band
   * at random, so the language gate compares against this, not a literal 'en'.
   */
  language: 'en',
  /** Self-check bounds; a miscomputing backend collapses the gap. */
  probeMinNear: 0.78,
  probeMinGap: 0.06,
} as const;

/**
 * Strictness 0-10. Each step is a measured threshold, chosen so the step spends
 * roughly a tenth of the feed — the scale is even in what the reader sees, not
 * in cosine, because cosine is not evenly spaced. Measured over 615
 * observations; see wiki-llm/model.md.
 */
export const STRICTNESS_STEPS = [
  { threshold: 0.69, shown: 1.0, junk: 0.87 },
  { threshold: 0.74, shown: 0.9, junk: 0.86 },
  { threshold: 0.75, shown: 0.8, junk: 0.85 },
  { threshold: 0.76, shown: 0.7, junk: 0.82 },
  { threshold: 0.765, shown: 0.6, junk: 0.8 },
  { threshold: 0.775, shown: 0.5, junk: 0.73 },
  { threshold: 0.78, shown: 0.4, junk: 0.71 },
  { threshold: 0.79, shown: 0.3, junk: 0.6 },
  { threshold: 0.8, shown: 0.2, junk: 0.54 },
  { threshold: 0.81, shown: 0.1, junk: 0.49 },
  { threshold: 0.82, shown: 0.05, junk: 0.52 },
] as const;

/**
 * Best F1 on the labelled set. Going 5 -> 7 costs 9 points of recall and halves
 * the junk that still gets through, which is the trade the product exists to
 * make: a false blur is labelled and one click away, a false pass is invisible.
 */
export const DEFAULT_STRICTNESS = 7;

export const formatTopic = (topic: string): string => `query: ${topic}`;
export const formatPost = (text: string): string => `passage: ${text}`;

/** Probe pair for the backend self-check: one related, one not. */
export const PROBE = {
  anchor: 'software engineering',
  near: 'writing code and building software systems',
  far: 'a recipe for chocolate cake with butter and eggs',
} as const;
