import {
  isEngineRequest,
  isInitRequest,
  isRoutedRequest,
  type EngineReply,
  type EngineRequest,
  type SetTopicsRequest,
} from '../../core/protocol';
import { captureConsole, logger } from '../../core/log';
import { Embedder } from '../../platform/embedder';
import {
  DEFAULT_MODEL,
  formatPost,
  formatTopic,
  modelFor,
  type ModelSpec,
} from '../../core/models';
import {
  bestMatch,
  pooled,
  ratingNear,
  type Rated,
  type Vector,
} from '../../core/scoring';

// transformers.js and ORT print handled conditions through console.warn and
// console.error, which the browser's extension Errors page collects as faults.
captureConsole('runtime');

const log = logger('worker');
const embedder = new Embedder();

interface Topics {
  request: SetTopicsRequest;
  /** Every line's ratings together; see `pooled`. */
  rated: Rated;
  vectors?: Promise<Vector[]>;
  embedded?: Vector[];
}

/** Kept past a failed load, so the next load still has the query to embed. */
const topics = new Map<string, Topics>();
let loading: Promise<void> | undefined;
let unexpectedFailure: Error | undefined;
let threads = 1;
let work = Promise.resolve();

/**
 * Set once by INIT, before any request can arrive, and never changed: a worker
 * loads one model for its whole life. Switching models replaces the client transport.
 */
let spec: ModelSpec = modelFor(DEFAULT_MODEL);

const post = (reply: EngineReply, clientId = '') =>
  self.postMessage(clientId ? { clientId, reply } : reply);

self.addEventListener('unhandledrejection', (event) => {
  event.preventDefault();
  unexpectedFailure = asError(event.reason);
  log.warn('worker stopped after an unhandled rejection', {
    reason: unexpectedFailure.message,
  });
  post({ type: 'STATUS', state: 'error', message: unexpectedFailure.message });
});

function ensureLoaded(): Promise<void> {
  if (unexpectedFailure) return Promise.reject(unexpectedFailure);
  const progress = (p: {
    state: 'downloading' | 'warming' | 'ready';
    progress?: number;
  }) => {
    if (p.state === 'downloading')
      log.info('downloading', { percent: Math.round(p.progress ?? 0) });
    post({ type: 'STATUS', state: p.state, progress: p.progress });
  };
  loading ??= embedder
    .load(spec, progress, undefined, threads)
    .catch((error: unknown) => {
      if (threads === 1) throw error;
      log.warn('two-thread load failed, retrying single-threaded', {
        reason: describe(error),
      });
      threads = 1;
      return embedder.load(spec, progress, undefined, 1);
    })
    .then(() => {
      if (unexpectedFailure) throw unexpectedFailure;
      log.info('ready', { model: spec.label, device: embedder.device });
      post({ type: 'STATUS', state: 'ready' });
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
  const vectors = await embedder.embed(request.topics.map((t) => formatTopic(t, spec)));
  log.info('topics embedded', {
    model: spec.label,
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
function next(request: SetTopicsRequest, previous: Topics | undefined): Topics {
  const same =
    previous !== undefined &&
    previous.request.topics.length === request.topics.length &&
    previous.request.topics.every((t, i) => t === request.topics[i]);
  return {
    request,
    rated: ratedOf(request),
    embedded: same ? previous?.embedded : undefined,
  };
}

function ratedOf(request: SetTopicsRequest): Rated {
  return pooled(
    (request.corrections ?? []).map((c) => ({
      liked: toVectors(c.liked),
      disliked: toVectors(c.disliked),
    })),
  );
}

self.onmessage = (event: MessageEvent<unknown>) => {
  const request = event.data;
  if (isInitRequest(request)) {
    spec = modelFor(request.model);
    threads = request.threads === 2 && self.crossOriginIsolated ? 2 : 1;
    log.info('model selected', { model: spec.label, dim: spec.dim });
    return;
  }
  if (
    typeof request === 'object' &&
    request !== null &&
    'type' in request &&
    request.type === 'RELEASE' &&
    'clientId' in request &&
    typeof request.clientId === 'string'
  ) {
    const clientId = request.clientId;
    work = work.then(() => {
      topics.delete(clientId);
    });
    return;
  }
  const routed = isRoutedRequest(request);
  const clientId = routed ? request.clientId : '';
  const message = routed ? request.request : request;
  if (!isEngineRequest(message)) return;
  if (routed) {
    work = work.then(() => {
      if (message.type === 'SET_TOPICS')
        topics.set(clientId, next(message, topics.get(clientId)));
      return handle(message, clientId);
    });
  } else {
    // Keep the per-tab iframe's existing request behavior on Firefox and e5.
    if (message.type === 'SET_TOPICS')
      topics.set(clientId, next(message, topics.get(clientId)));
    void handle(message, clientId);
  }
};

async function handle(request: EngineRequest, clientId: string): Promise<void> {
  try {
    await ensureLoaded();
  } catch (error: unknown) {
    post({ id: request.id, type: 'ERROR', message: describe(error) }, clientId);
    return;
  }
  try {
    const current = topics.get(clientId);
    const vectors = await topicVectors(current);
    if (request.type === 'SET_TOPICS') {
      post({ id: request.id, type: 'ACK' }, clientId);
      return;
    }
    if (request.type === 'FEEDBACK') {
      const [vector] = await embedder.embed([formatPost(request.text, spec)]);
      const topic = vector ? bestMatch(vector, vectors).topic : -1;
      log.info('feedback embedded', { liked: request.liked, topic });
      post(
        { id: request.id, type: 'VECTOR', vector: [...(vector ?? [])], topic },
        clientId,
      );
      return;
    }
    if (vectors.length === 0) throw new Error('scored before any topics were set');
    const started = Date.now();
    const embedded = await embedder.embed(request.texts.map((t) => formatPost(t, spec)));
    const matches = embedded.map((v) => bestMatch(v, vectors));
    const rated = current?.rated ?? { liked: [], disliked: [] };
    const ratings = embedded.map(
      (v) => ratingNear(v, rated.liked, rated.disliked, spec.ratingNear) ?? null,
    );
    const scores = matches.map((m) => m.score);
    const elapsed = Date.now() - started;
    log.info('scored', {
      posts: scores.length,
      msPerPost: scores.length ? Math.round(elapsed / scores.length) : 0,
      device: embedder.device,
      max: scores.length ? Math.max(...scores).toFixed(3) : undefined,
      rated: ratings.filter((r) => r !== null).length,
    });
    post(
      {
        id: request.id,
        type: 'SCORES',
        scores,
        topics: matches.map((m) => m.topic),
        lines: matches.map((m) => m.lines),
        ratings,
      },
      clientId,
    );
  } catch (error: unknown) {
    log.error('request failed', { type: request.type, reason: describe(error) });
    post({ id: request.id, type: 'ERROR', message: describe(error) }, clientId);
  }
}

/** A vector of the wrong width would throw in cosine and stop every batch on its line. */
function toVectors(rows: number[][] | undefined): Vector[] {
  return (rows ?? [])
    .filter((row) => row.length === spec.dim)
    .map((row) => Float32Array.from(row));
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function asError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}
