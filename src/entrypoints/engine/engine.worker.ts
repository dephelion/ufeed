import {
  isEngineRequest,
  isInitRequest,
  type EngineReply,
  type EngineRequest,
  type SetTopicsRequest,
} from '../../core/protocol';
import { captureConsole, logger } from '../../core/log';
import { topicsEqual } from '../../core/settings';
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

self.addEventListener('unhandledrejection', (event) => {
  event.preventDefault();
  log.error('unhandled rejection in worker', { reason: describe(event.reason) });
});

interface Topics {
  request: SetTopicsRequest;
  /** Every line's ratings together; see `pooled`. */
  rated: Rated;
  vectors?: Promise<Embedded>;
  embedded?: Embedded;
}

interface Embedded {
  topics: Vector[];
  blacklist: Vector[];
}

/** Kept past a failed load, so the next load still has the query to embed. */
let topics: Topics | undefined;
let loading: Promise<void> | undefined;

/**
 * Set once by INIT, before any request can arrive, and never changed: a worker
 * loads one model for its whole life. Switching models replaces the frame.
 */
let spec: ModelSpec = modelFor(DEFAULT_MODEL);

const post = (reply: EngineReply) => self.postMessage(reply);

function ensureLoaded(): Promise<void> {
  loading ??= embedder
    .load(spec, (p) => {
      if (p.state === 'downloading')
        log.info('downloading', { percent: Math.round(p.progress ?? 0) });
      post({ type: 'STATUS', state: p.state, progress: p.progress });
    })
    .then(() => {
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

function topicVectors(current: Topics | undefined): Promise<Embedded> {
  if (!current) return Promise.resolve({ topics: [], blacklist: [] });
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

async function embedTopics(request: SetTopicsRequest): Promise<Embedded> {
  const blacklist = request.blacklist ?? [];
  const lines = [...request.topics, ...blacklist];
  const vectors = await embedder.embed(lines.map((t) => formatTopic(t, spec)));
  log.info('topics embedded', {
    model: spec.label,
    count: vectors.length,
    topics: JSON.stringify(request.topics),
    blacklist: JSON.stringify(blacklist),
    rated: (request.corrections ?? []).reduce(
      (n, c) => n + c.liked.length + c.disliked.length,
      0,
    ),
  });
  const split = request.topics.length;
  return { topics: vectors.slice(0, split), blacklist: vectors.slice(split) };
}

/** A change of ratings alone keeps the embedded topics: thumbs never move them. */
function next(request: SetTopicsRequest): Topics {
  const same =
    topics !== undefined &&
    topicsEqual(topics.request.topics, request.topics) &&
    topicsEqual(topics.request.blacklist ?? [], request.blacklist ?? []);
  return {
    request,
    rated: ratedOf(request),
    embedded: same ? topics?.embedded : undefined,
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
    log.info('model selected', { model: spec.label, dim: spec.dim });
    return;
  }
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
    const { topics: vectors, blacklist } = await topicVectors(current);
    if (request.type === 'SET_TOPICS') {
      post({ id: request.id, type: 'ACK' });
      return;
    }
    if (request.type === 'FEEDBACK') {
      const [vector] = await embedder.embed([formatPost(request.text, spec)]);
      const topic = vector ? bestMatch(vector, vectors).topic : -1;
      log.info('feedback embedded', { liked: request.liked, topic });
      post({ id: request.id, type: 'VECTOR', vector: [...(vector ?? [])], topic });
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
    const blocks = embedded.map((v) => bestMatch(v, blacklist).score);
    const elapsed = Date.now() - started;
    log.info('scored', {
      posts: scores.length,
      msPerPost: scores.length ? Math.round(elapsed / scores.length) : 0,
      device: embedder.device,
      max: scores.length ? Math.max(...scores).toFixed(3) : undefined,
      rated: ratings.filter((r) => r !== null).length,
      blocked: blocks.filter((b, i) => b > scores[i]!).length,
    });
    post({
      id: request.id,
      type: 'SCORES',
      scores,
      topics: matches.map((m) => m.topic),
      lines: matches.map((m) => m.lines),
      ratings,
      blocks,
    });
  } catch (error: unknown) {
    log.error('request failed', { type: request.type, reason: describe(error) });
    post({ id: request.id, type: 'ERROR', message: describe(error) });
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
