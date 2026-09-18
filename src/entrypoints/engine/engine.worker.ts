import {
  isEngineRequest,
  type EngineReply,
  type EngineRequest,
  type SetTopicsRequest,
} from '../../core/protocol';
import { captureConsole, logger } from '../../core/log';
import { Embedder } from '../../ml/embedder';
import { MODEL, formatPost, formatTopic } from '../../ml/models';
import { applyFeedback, bestMatch, type Vector } from '../../ml/scoring';

// transformers.js and ORT print handled conditions through console.warn and
// console.error, which the browser's extension Errors page collects as faults.
captureConsole('runtime');

const log = logger('worker');
const embedder = new Embedder();

self.addEventListener('unhandledrejection', (event) => {
  event.preventDefault();
  log.error('unhandled rejection in worker', { reason: describe(event.reason) });
});

/** Kept past a failed load, so the next load still has the query to embed. */
let topics: { request: SetTopicsRequest; vectors?: Promise<Vector[]> } | undefined;
let loading: Promise<void> | undefined;

const post = (reply: EngineReply) => self.postMessage(reply);

function ensureLoaded(): Promise<void> {
  if (!loading) log.info('loading model');
  loading ??= embedder
    .load((p) => {
      if (p.state === 'downloading')
        log.info('downloading', { percent: Math.round(p.progress ?? 0) });
      post({ type: 'STATUS', state: p.state, progress: p.progress });
    })
    .then((backend) => {
      log.info('ready', { backend });
      post({ type: 'STATUS', state: 'ready', backend });
    })
    .catch((error: unknown) => {
      loading = undefined;
      log.warn('model load failed', { reason: describe(error) });
      post({ type: 'STATUS', state: 'error', message: describe(error) });
      throw error;
    });
  return loading;
}

function topicVectors(): Promise<Vector[]> {
  const current = topics;
  if (!current) return Promise.resolve([]);
  current.vectors ??= embedTopics(current.request).catch((error: unknown) => {
    current.vectors = undefined;
    throw error;
  });
  return current.vectors;
}

async function embedTopics(request: SetTopicsRequest): Promise<Vector[]> {
  const base = await embedder.embed(request.topics.map(formatTopic));
  const vectors = base.map((v, i) => {
    const c = request.corrections?.[i];
    return c ? applyFeedback(v, toVectors(c.liked), toVectors(c.disliked)) : v;
  });
  log.info('topics embedded', {
    model: MODEL.label,
    count: vectors.length,
    topics: JSON.stringify(request.topics),
    corrected: (request.corrections ?? []).filter(
      (c) => c.liked.length + c.disliked.length > 0,
    ).length,
  });
  return vectors;
}

self.onmessage = (event: MessageEvent<unknown>) => {
  const request = event.data;
  if (!isEngineRequest(request)) return;
  if (request.type === 'SET_TOPICS') topics = { request };
  void handle(request);
};

async function handle(request: EngineRequest): Promise<void> {
  try {
    await ensureLoaded();
  } catch (error: unknown) {
    post({ id: request.id, type: 'ERROR', message: describe(error) });
    return;
  }
  try {
    const vectors = await topicVectors();
    if (request.type === 'SET_TOPICS') {
      post({ id: request.id, type: 'ACK' });
      return;
    }
    if (request.type === 'FEEDBACK') {
      const [vector] = await embedder.embed([formatPost(request.text)]);
      const topic = vector ? bestMatch(vector, vectors).topic : -1;
      log.info('feedback embedded', { liked: request.liked, topic });
      post({ id: request.id, type: 'VECTOR', vector: [...(vector ?? [])], topic });
      return;
    }
    if (vectors.length === 0) throw new Error('scored before any topics were set');
    const started = Date.now();
    const embedded = await embedder.embed(request.texts.map(formatPost));
    const matches = embedded.map((v) => bestMatch(v, vectors));
    const scores = matches.map((m) => m.score);
    const elapsed = Date.now() - started;
    log.info('scored', {
      posts: scores.length,
      msPerPost: scores.length ? Math.round(elapsed / scores.length) : 0,
      max: scores.length ? Math.max(...scores).toFixed(3) : undefined,
    });
    post({ id: request.id, type: 'SCORES', scores, topics: matches.map((m) => m.topic) });
  } catch (error: unknown) {
    log.error('request failed', { type: request.type, reason: describe(error) });
    post({ id: request.id, type: 'ERROR', message: describe(error) });
  }
}

function toVectors(rows: number[][] | undefined): Vector[] {
  return (rows ?? []).map((row) => Float32Array.from(row));
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
