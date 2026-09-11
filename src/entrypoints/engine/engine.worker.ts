import { isEngineRequest, type EngineReply, type EngineRequest } from '../../core/protocol';
import { Embedder } from '../../ml/embedder';
import { scoreAgainstTopics, type Vector } from '../../ml/scoring';

const embedder = new Embedder();
let topicVectors: Vector[] = [];
let loading: Promise<void> | undefined;

const post = (reply: EngineReply) => self.postMessage(reply);

function ensureLoaded(): Promise<void> {
  loading ??= embedder
    .load((p) => post({ type: 'STATUS', state: p.state, progress: p.progress }))
    .then((backend) => {
      post({ type: 'STATUS', state: 'ready', backend });
    })
    .catch((error: unknown) => {
      loading = undefined;
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
      topicVectors = await embedder.embed(request.topics);
      post({ id: request.id, type: 'ACK' });
      return;
    }
    const vectors = await embedder.embed(request.texts);
    post({
      id: request.id,
      type: 'SCORES',
      scores: vectors.map((v) => scoreAgainstTopics(v, topicVectors)),
    });
  } catch (error: unknown) {
    post({ id: request.id, type: 'ERROR', message: describe(error) });
  }
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
