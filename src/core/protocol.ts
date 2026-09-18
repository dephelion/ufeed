export type EngineState = 'idle' | 'downloading' | 'warming' | 'ready' | 'error';
export type Backend = 'webgpu' | 'wasm';

export interface ScoreRequest {
  id: string;
  type: 'SCORE';
  texts: string[];
}

export interface SetTopicsRequest {
  id: string;
  type: 'SET_TOPICS';
  topics: string[];
  /** Rated posts per topic, aligned with `topics`; they override near-identical posts. */
  corrections?: TopicCorrections[];
}

export interface TopicCorrections {
  liked: number[][];
  disliked: number[][];
}

/** The user corrected a verdict. The worker owns vectors, so it does the embedding. */
export interface FeedbackRequest {
  id: string;
  type: 'FEEDBACK';
  text: string;
  liked: boolean;
}

export type EngineRequest = ScoreRequest | SetTopicsRequest | FeedbackRequest;

/** Raw cosine scores, never booleans: the threshold is re-applied without inference. */
export interface ScoresReply {
  id: string;
  type: 'SCORES';
  scores: number[];
  /** The line each score came from, aligned with `scores`. */
  topics: number[];
  /** A near-identical rated post on that line: true liked, false disliked, null none. */
  ratings: (boolean | null)[];
}

/**
 * The embedding of a corrected post, plus the line it belongs to: scoring takes
 * the max, so a correction attaches to the line that came closest to claiming the
 * post. `topic` is -1 when there is no line to attach it to.
 */
export interface VectorReply {
  id: string;
  type: 'VECTOR';
  vector: number[];
  topic: number;
}

export interface AckReply {
  id: string;
  type: 'ACK';
}

export interface ErrorReply {
  id: string;
  type: 'ERROR';
  message: string;
}

export interface StatusEvent {
  type: 'STATUS';
  state: EngineState;
  backend?: Backend;
  progress?: number;
  message?: string;
}

export type EngineReply = ScoresReply | VectorReply | AckReply | ErrorReply | StatusEvent;

export const HANDSHAKE = 'lensing:port';

export interface Handshake {
  type: typeof HANDSHAKE;
}

export function isHandshake(data: unknown): data is Handshake {
  return isRecord(data) && data.type === HANDSHAKE;
}

export function isEngineRequest(data: unknown): data is EngineRequest {
  if (!isRecord(data) || typeof data.id !== 'string') return false;
  if (data.type === 'SCORE') return isStringArray(data.texts);
  if (data.type === 'SET_TOPICS')
    return isStringArray(data.topics) && isCorrections(data.corrections);
  if (data.type === 'FEEDBACK')
    return typeof data.text === 'string' && typeof data.liked === 'boolean';
  return false;
}

export function isEngineReply(data: unknown): data is EngineReply {
  if (!isRecord(data)) return false;
  switch (data.type) {
    case 'SCORES':
      return (
        typeof data.id === 'string' &&
        isNumberArray(data.scores) &&
        isNumberArray(data.topics) &&
        data.topics.length === data.scores.length &&
        Array.isArray(data.ratings) &&
        data.ratings.length === data.scores.length &&
        data.ratings.every((r) => r === null || typeof r === 'boolean')
      );
    case 'VECTOR':
      return (
        typeof data.id === 'string' &&
        typeof data.topic === 'number' &&
        Array.isArray(data.vector) &&
        data.vector.every((n) => typeof n === 'number')
      );
    case 'ACK':
      return typeof data.id === 'string';
    case 'ERROR':
      return typeof data.id === 'string' && typeof data.message === 'string';
    case 'STATUS':
      return typeof data.state === 'string';
    default:
      return false;
  }
}

let counter = 0;
export function nextRequestId(): string {
  counter += 1;
  return `r${counter}`;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

function isVectors(v: unknown): v is number[][] {
  return (
    Array.isArray(v) &&
    v.every((row) => Array.isArray(row) && row.every((n) => typeof n === 'number'))
  );
}

function isCorrections(v: unknown): v is TopicCorrections[] | undefined {
  return (
    v === undefined ||
    (Array.isArray(v) &&
      v.every((c) => isRecord(c) && isVectors(c.liked) && isVectors(c.disliked)))
  );
}

function isNumberArray(v: unknown): v is number[] {
  return Array.isArray(v) && v.every((n) => typeof n === 'number');
}

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((s) => typeof s === 'string');
}
