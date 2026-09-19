import { env, pipeline, type FeatureExtractionPipeline } from '@huggingface/transformers';
import { logger } from '../core/log';
import { MODEL, PROBE, formatPost, formatTopic } from '../core/models';
import { cosine, normalize, type Vector } from '../core/scoring';

const log = logger('embedder');

/** Model weights come from the CDN; the runtime itself ships with the extension. */
env.allowLocalModels = false;
if (env.backends.onnx.wasm) env.backends.onnx.wasm.wasmPaths = '/ort/';

/**
 * ORT logs at WARNING by default and pipes its stderr through `console.error`, so
 * every load printed two red lines about shape ops being assigned to CPU — which is
 * ORT doing the right thing on purpose. Error and above is what we want to hear.
 * Set on the session too: the global env alone does not reach the session logger.
 */
env.backends.onnx.logLevel = 'error';
const SESSION_OPTIONS = { logSeverityLevel: 3 } as const;

/** WASM in the browser, CPU under Node. WebGPU miscomputes q8; see wiki-llm/model.md. */
export type Device = 'wasm' | 'cpu';

export interface EmbedderProgress {
  state: 'downloading' | 'warming' | 'ready';
  progress?: number;
}

export class Embedder {
  #pipe: FeatureExtractionPipeline | undefined;

  async load(
    onProgress?: (p: EmbedderProgress) => void,
    device: Device = 'wasm',
  ): Promise<void> {
    if (this.#pipe) return;

    const report = (item: { status?: string; progress?: number }) => {
      if (item.status === 'progress') {
        onProgress?.({ state: 'downloading', progress: item.progress });
      }
    };

    const started = Date.now();
    log.info('loading model', { device, model: MODEL.id });
    this.#pipe = await pipeline<'feature-extraction'>('feature-extraction', MODEL.id, {
      device,
      dtype: 'q8',
      progress_callback: report,
      session_options: SESSION_OPTIONS,
    });

    onProgress?.({ state: 'warming' });
    const probe = await this.selfCheck();
    const fields = { near: probe.near.toFixed(3), far: probe.far.toFixed(3) };
    if (!probe.ok) {
      this.#pipe = undefined;
      throw new Error(
        `model returns wrong vectors (near=${fields.near} far=${fields.far})`,
      );
    }

    log.info('model loaded', { device, ms: Date.now() - started, ...fields });
    onProgress?.({ state: 'ready' });
  }

  /**
   * A runtime can load, report ready, and return confident nonsense — q8 on
   * WebGPU did. The gap between a related and an unrelated pair is what
   * collapses when it happens, and unlike absolute scores it is comparable
   * across models.
   */
  async selfCheck(): Promise<{ ok: boolean; near: number; far: number }> {
    const [anchor, near, far] = await this.embed([
      formatTopic(PROBE.anchor),
      formatPost(PROBE.near),
      formatPost(PROBE.far),
    ]);
    if (!anchor || !near || !far) return { ok: false, near: NaN, far: NaN };
    const nearScore = cosine(anchor, near);
    const farScore = cosine(anchor, far);
    return {
      ok: nearScore >= MODEL.probeMinNear && nearScore - farScore >= MODEL.probeMinGap,
      near: nearScore,
      far: farScore,
    };
  }

  /**
   * One text per model call: q8 quantizes activations per batch, so a batched
   * score moves with its neighbours. See wiki-llm/model.md §Determinism.
   */
  async embed(texts: readonly string[]): Promise<Vector[]> {
    if (!this.#pipe) throw new Error('embedder used before load()');
    const vectors: Vector[] = [];
    for (const text of texts) {
      const output = await this.#pipe([text], { pooling: 'mean', normalize: true });
      vectors.push(normalize((output.data as Float32Array).slice()));
    }
    return vectors;
  }
}
