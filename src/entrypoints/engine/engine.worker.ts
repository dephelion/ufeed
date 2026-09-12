import {
  isEngineRequest,
  type EngineReply,
  type EngineRequest,
} from '../../core/protocol';
import { logger } from '../../core/log';
import { Embedder } from '../../ml/embedder';
import { MODEL, formatPost, formatTopic } from '../../ml/models';
import { applyFeedback, cosine, scoreAgainstTopics, type Vector } from '../../ml/scoring';

const log = logger('worker');
const embedder = new Embedder();

self.addEventListener('unhandledrejection', (event) => {
  log.error('unhandled rejection in worker', { reason: String(event.reason) });
});
let topicVectors: Vector[] = [];
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
      log.error('model load failed', { reason: describe(error) });
      post({ type: 'STATUS', state: 'error', message: describe(error) });
      throw error;
    });
  return loading;
}

self.onmessage = (event: MessageEvent<unknown>) => {
  const request = event.data;
  if (!isEngineRequest(request)) return;
  void handle(request);
};

async function handle(request: EngineRequest): Promise<void> {
  try {
    await ensureLoaded();
    if (request.type === 'SET_TOPICS') {
      const base = await embedder.embed(request.topics.map(formatTopic));
      topicVectors = base.map((v, i) => {
        const c = request.corrections?.[i];
        return c ? applyFeedback(v, toVectors(c.liked), toVectors(c.disliked)) : v;
      });
      log.info('topics embedded', {
        model: MODEL.label,
        count: topicVectors.length,
        topics: JSON.stringify(request.topics),
        corrected: (request.corrections ?? []).filter(
          (c) => c.liked.length + c.disliked.length > 0,
        ).length,
      });
      post({ id: request.id, type: 'ACK' });
      return;
    }
    if (request.type === 'FEEDBACK') {
      const [vector] = await embedder.embed([formatPost(request.text)]);
      const topic = vector ? bestTopic(vector) : -1;
      log.info('feedback embedded', { liked: request.liked, topic });
      post({ id: request.id, type: 'VECTOR', vector: [...(vector ?? [])], topic });
      return;
    }
    const started = Date.now();
    const vectors = await embedder.embed(request.texts.map(formatPost));
    const scores = vectors.map((v) => scoreAgainstTopics(v, topicVectors));
    const elapsed = Date.now() - started;
    log.info('scored', {
      posts: scores.length,
      msPerPost: scores.length ? Math.round(elapsed / scores.length) : 0,
      max: scores.length ? Math.max(...scores).toFixed(3) : undefined,
    });
    post({ id: request.id, type: 'SCORES', scores });
  } catch (error: unknown) {
    log.error('scoring failed', { reason: describe(error) });
    post({ id: request.id, type: 'ERROR', message: describe(error) });
  }
}

function toVectors(rows: number[][] | undefined): Vector[] {
  return (rows ?? []).map((row) => Float32Array.from(row));
}

/** The line that came closest to claiming the post is the one being corrected. */
function bestTopic(vector: Vector): number {
  let best = -1;
  let bestScore = -Infinity;
  topicVectors.forEach((topic, i) => {
    const score = cosine(topic, vector);
    if (score > bestScore) {
      bestScore = score;
      best = i;
    }
  });
  return best;
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
