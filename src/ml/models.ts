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
   * Usable threshold band. Unrelated text sits near 0.74 with this model, not
   * near zero, and everything above 0.83 blurs the whole feed — so the slider
   * spans only the range where moving it changes something.
   */
  bandMin: 0.76,
  bandMax: 0.83,
  /**
   * Deliberately forgiving. On-topic averages 0.806 and off-topic 0.771, so the
   * decision lives in a 0.035 strip and near-misses are unavoidable. A false
   * blur costs a click on something you wanted; a false pass costs one scroll
   * past something you did not.
   */
  defaultPosition: 0.35,
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
