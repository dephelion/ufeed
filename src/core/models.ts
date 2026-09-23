/**
 * The models uFeed can score with. Every number here was measured; the
 * measurements and the reasoning live in wiki-llm/model.md, never in this file.
 *
 * Both are retrieval models, so the topic and the post are tagged differently:
 * the topic is the query, the post is the passage. The prefixes are mandatory
 * and asymmetric, and each model has its own.
 */
export type ModelKey = 'e5-small' | 'gemma';

export interface StrictnessStep {
  threshold: number;
  shown: number;
}

export interface ModelSpec {
  key: ModelKey;
  id: string;
  label: string;
  /** Embedding width. A vector of any other length is from another model. */
  dim: number;
  dtype: 'q8' | 'q4';
  /** Rounded download size, for the popup. */
  megabytes: number;
  /**
   * The only language it reads, or undefined when it reads them all. The language
   * gate compares against this, never a literal 'en', so a model swap moves it.
   */
  language?: string;
  topicPrefix: string;
  postPrefix: string;
  /** Self-check bounds; a miscomputing backend collapses the gap. */
  probeMinNear: number;
  probeMinGap: number;
  /** Similarity at which a rated post overrides the topic score. */
  ratingNear: number;
  /** Width of the uncertain strip below the threshold that earns a peek. */
  peekBand: number;
  /**
   * Strictness 0-10. Each step is a measured threshold, chosen so the step spends
   * roughly a tenth of the feed — the scale is even in what the reader sees, not
   * in cosine, because cosine is not evenly spaced.
   */
  strictness: readonly StrictnessStep[];
  /** Try WebGPU before WASM. Only a model whose probe passes there may. */
  tryWebGPU: boolean;
  /**
   * Posts per SCORE request. Batching buys no throughput (measured), so this is
   * purely how long the reader waits for the first verdict and how much head-room
   * the request keeps against the engine timeout. A slow model wants a small one.
   */
  batchSize: number;
}

/**
 * Chosen by measurement over all-MiniLM-L6-v2 and bge-small-en-v1.5 on 205
 * labelled posts, and the default because it is a tenth the size of the other
 * and fast enough to be invisible. It reads English only.
 */
const E5_SMALL: ModelSpec = {
  key: 'e5-small',
  id: 'Xenova/e5-small-v2',
  label: 'e5-small-v2',
  dim: 384,
  dtype: 'q8',
  megabytes: 33,
  language: 'en',
  topicPrefix: 'query: ',
  postPrefix: 'passage: ',
  probeMinNear: 0.78,
  probeMinGap: 0.06,
  ratingNear: 0.9,
  peekBand: 0.01,
  strictness: [
    { threshold: 0.69, shown: 1.0 },
    { threshold: 0.74, shown: 0.9 },
    { threshold: 0.75, shown: 0.8 },
    { threshold: 0.76, shown: 0.7 },
    { threshold: 0.765, shown: 0.6 },
    { threshold: 0.775, shown: 0.5 },
    { threshold: 0.78, shown: 0.4 },
    { threshold: 0.79, shown: 0.3 },
    { threshold: 0.8, shown: 0.2 },
    { threshold: 0.81, shown: 0.1 },
    { threshold: 0.82, shown: 0.05 },
  ],
  // Measured to miscompute q8 on WebGPU: every load paid for a session it threw away.
  tryWebGPU: false,
  batchSize: 5,
};

/**
 * Reads every language, and separates better than e5-small-v2 even in English.
 * It costs about nine times the compute per post and six times the download, so
 * it is opt-in until that is measured in a browser rather than in node.
 *
 * Its thresholds, probe bounds and ratingNear are PROVISIONAL — derived so a
 * feed looks sane, not measured the way e5-small-v2's were. See wiki-llm/model.md.
 */
const GEMMA: ModelSpec = {
  key: 'gemma',
  id: 'onnx-community/embeddinggemma-300m-ONNX',
  label: 'EmbeddingGemma-300m',
  dim: 768,
  dtype: 'q4',
  megabytes: 197,
  topicPrefix: 'task: search result | query: ',
  postPrefix: 'title: none | text: ',
  probeMinNear: 0.49,
  probeMinGap: 0.23,
  ratingNear: 0.66,
  peekBand: 0.02,
  strictness: [
    { threshold: -0.047, shown: 1.0 },
    { threshold: 0.051, shown: 0.9 },
    { threshold: 0.078, shown: 0.8 },
    { threshold: 0.1, shown: 0.7 },
    { threshold: 0.12, shown: 0.6 },
    { threshold: 0.141, shown: 0.5 },
    { threshold: 0.163, shown: 0.4 },
    { threshold: 0.188, shown: 0.3 },
    { threshold: 0.218, shown: 0.2 },
    { threshold: 0.253, shown: 0.1 },
    { threshold: 0.299, shown: 0.05 },
  ],
  // Measured to miscompute q4 on WebGPU too (near 0.353, far 0.375, against 0.597 and
  // 0.138 on WASM), unchanged by onnxruntime-web 1.30 or by turning the optimizer off.
  tryWebGPU: false,
  batchSize: 1,
};

export const MODELS: Record<ModelKey, ModelSpec> = {
  'e5-small': E5_SMALL,
  gemma: GEMMA,
};

export const DEFAULT_MODEL: ModelKey = 'e5-small';

export function isModelKey(value: unknown): value is ModelKey {
  return typeof value === 'string' && Object.hasOwn(MODELS, value);
}

/** Falls back rather than throwing: this reads stored and imported values. */
export function modelFor(key: unknown): ModelSpec {
  return MODELS[isModelKey(key) ? key : DEFAULT_MODEL];
}

/** The model that made a stored vector, by id, or undefined if nothing matches. */
export function modelById(id: unknown): ModelSpec | undefined {
  return Object.values(MODELS).find((spec) => spec.id === id);
}

/**
 * Best F1 on the labelled set for e5-small-v2. The step means the same thing in
 * both tables — roughly 30% of a feed shown — so it survives a model switch.
 */
export const DEFAULT_STRICTNESS = 7;

export const formatTopic = (topic: string, spec: ModelSpec): string =>
  `${spec.topicPrefix}${topic}`;

export const formatPost = (text: string, spec: ModelSpec): string =>
  `${spec.postPrefix}${text}`;

/** Probe pair for the backend self-check: one related, one not. */
export const PROBE = {
  anchor: 'software engineering',
  near: 'writing code and building software systems',
  far: 'a recipe for chocolate cake with butter and eggs',
} as const;
