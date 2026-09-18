import {
  isEngineRequest,
  type EngineReply,
  type EngineRequest,
  type SetTopicsRequest,
} from '../../core/protocol';
import { captureConsole, logger } from '../../core/log';
import { Embedder } from '../../ml/embedder';
import { MODEL, formatPost, formatTopic } from '../../ml/models';
import { bestMatch, ratingFor, type Rated, type Vector } from '../../ml/scoring';

// transformers.js and ORT print handled conditions through console.warn and
// console.error, which the browser's extension Errors page collects as faults.
captureConsole('runtime');

const log = logger('worker');
const embedder = new Embedder();

self.addEventListener('unhandledrejection', (event) => {
  event.preventDefault();
  log.error('unhandled rejection in worker', { reason: describe(event.reason) });
});

interface Topics {
  request: SetTopicsRequest;
  /** Aligned with `request.topics`; a line with no ratings has empty lists. */
  rated: Rated[];
  vectors?: Promise<Vector[]>;
  embedded?: Vector[];
}

/** Kept past a failed load, so the next load still has the query to embed. */
let topics: Topics | undefined;
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

function topicVectors(current: Topics | undefined): Promise<Vector[]> {
  if (!current) return Promise.resolve([]);
  if (current.embedded) return Promise.resolve(current.embedded);
  current.vectors ??= embedTopics(current.request).then(
    (vectors) => (current.embedded = vectors),
    (error: unknown) => {
      current.vectors = undefined;
      throw error;
    },
  );
  return current.vectors;
}

async function embedTopics(request: SetTopicsRequest): Promise<Vector[]> {
  const vectors = await embedder.embed(request.topics.map(formatTopic));
  log.info('topics embedded', {
    model: MODEL.label,
    count: vectors.length,
    topics: JSON.stringify(request.topics),
    rated: (request.corrections ?? []).reduce(
      (n, c) => n + c.liked.length + c.disliked.length,
      0,
    ),
  });
  return vectors;
}

/** A change of ratings alone keeps the embedded topics: thumbs never move them. */
function next(request: SetTopicsRequest): Topics {
  const same =
    topics !== undefined &&
    topics.request.topics.length === request.topics.length &&
    topics.request.topics.every((t, i) => t === request.topics[i]);
  return {
    request,
    rated: ratedOf(request),
    embedded: same ? topics?.embedded : undefined,
  };
}

function ratedOf(request: SetTopicsRequest): Rated[] {
  return request.topics.map((_, i) => ({
    liked: toVectors(request.corrections?.[i]?.liked),
    disliked: toVectors(request.corrections?.[i]?.disliked),
  }));
}

self.onmessage = (event: MessageEvent<unknown>) => {
  const request = event.data;
  if (!isEngineRequest(request)) return;
  if (request.type === 'SET_TOPICS') topics = next(request);
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
    const current = topics;
    const vectors = await topicVectors(current);
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
    const ratings = embedded.map(
      (v, i) =>
        ratingFor(v, matches[i]!.topic, current?.rated ?? [], MODEL.ratingNear) ?? null,
    );
    const scores = matches.map((m) => m.score);
    const elapsed = Date.now() - started;
    log.info('scored', {
      posts: scores.length,
      msPerPost: scores.length ? Math.round(elapsed / scores.length) : 0,
      max: scores.length ? Math.max(...scores).toFixed(3) : undefined,
      rated: ratings.filter((r) => r !== null).length,
    });
    post({
      id: request.id,
      type: 'SCORES',
      scores,
      topics: matches.map((m) => m.topic),
      ratings,
    });
  } catch (error: unknown) {
    log.error('request failed', { type: request.type, reason: describe(error) });
    post({ id: request.id, type: 'ERROR', message: describe(error) });
  }
}

/** A vector of the wrong width would throw in cosine and stop every batch on its line. */
function toVectors(rows: number[][] | undefined): Vector[] {
  return (rows ?? [])
    .filter((row) => row.length === MODEL.dim)
    .map((row) => Float32Array.from(row));
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
