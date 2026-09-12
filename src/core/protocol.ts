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
  /** Corrections for exactly these topics; the worker re-derives its query from them. */
  liked?: number[][];
  disliked?: number[][];
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
}

/** The embedding of a corrected post, handed back so the content script can persist it. */
export interface VectorReply {
  id: string;
  type: 'VECTOR';
  vector: number[];
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
    return (
      isStringArray(data.topics) && isVectors(data.liked) && isVectors(data.disliked)
    );
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
        Array.isArray(data.scores) &&
        data.scores.every((n) => typeof n === 'number')
      );
    case 'VECTOR':
      return (
        typeof data.id === 'string' &&
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

function isVectors(v: unknown): v is number[][] | undefined {
  return (
    v === undefined ||
    (Array.isArray(v) &&
      v.every((row) => Array.isArray(row) && row.every((n) => typeof n === 'number')))
  );
}

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((s) => typeof s === 'string');
}
