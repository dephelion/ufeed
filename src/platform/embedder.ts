import {
  AutoModel,
  AutoTokenizer,
  env,
  pipeline,
  type FeatureExtractionPipeline,
  type PreTrainedModel,
  type PreTrainedTokenizer,
} from '@huggingface/transformers';
import { logger } from '../core/log';
import { PROBE, formatPost, formatTopic, type ModelSpec } from '../core/models';
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

/**
 * WASM in the browser, CPU under Node. WebGPU is attempted only for a model whose
 * spec asks for it, and only survives if the probe passes; see wiki-llm/model.md.
 */
export type Device = 'webgpu' | 'wasm' | 'cpu';

export interface EmbedderProgress {
  state: 'downloading' | 'warming' | 'ready';
  progress?: number;
}

type EmbedOne = (text: string) => Promise<Vector>;

export class Embedder {
  #embed: EmbedOne | undefined;
  #spec: ModelSpec | undefined;
  #device: Device | undefined;

  /** Which backend actually survived the probe. Undefined until loaded. */
  get device(): Device | undefined {
    return this.#device;
  }

  get spec(): ModelSpec | undefined {
    return this.#spec;
  }

  /**
   * Loads `spec`, trying each backend it allows and keeping the first whose
   * probe passes. A backend that loads, reports ready and returns nonsense is
   * the failure this guards: it is caught here rather than in the feed.
   */
  async load(
    spec: ModelSpec,
    onProgress?: (p: EmbedderProgress) => void,
    forced?: Device,
  ): Promise<void> {
    if (this.#embed) return;

    const order: Device[] = forced
      ? [forced]
      : spec.tryWebGPU
        ? ['webgpu', 'wasm']
        : ['wasm'];

    let last: unknown;
    for (const device of order) {
      const started = Date.now();
      try {
        log.info('loading model', { device, model: spec.id, dtype: spec.dtype });
        const embed = await this.#build(spec, device, onProgress);

        onProgress?.({ state: 'warming' });
        const probe = await this.#probe(spec, embed);
        const fields = { near: probe.near.toFixed(3), far: probe.far.toFixed(3) };
        if (!probe.ok) {
          throw new Error(
            `model returns wrong vectors on ${device} (near=${fields.near} far=${fields.far})`,
          );
        }

        this.#embed = embed;
        this.#spec = spec;
        this.#device = device;
        log.info('model loaded', { device, ms: Date.now() - started, ...fields });
        onProgress?.({ state: 'ready' });
        return;
      } catch (error: unknown) {
        last = error;
        // Not fatal while another backend is left: a rejected WebGPU session is
        // exactly what the probe exists to catch, and WASM still has to be tried.
        log.warn('backend rejected', {
          device,
          reason: error instanceof Error ? error.message : String(error),
          remaining: order.length - order.indexOf(device) - 1,
        });
      }
    }
    throw last instanceof Error ? last : new Error(String(last));
  }

  /**
   * Two shapes of model, one interface. e5 is a plain feature-extraction
   * pipeline with mean pooling; EmbeddingGemma carries its own pooling and
   * returns `sentence_embedding`, so pooling it again would be wrong.
   */
  async #build(
    spec: ModelSpec,
    device: Device,
    onProgress?: (p: EmbedderProgress) => void,
  ): Promise<EmbedOne> {
    const progress_callback = (item: { status?: string; progress?: number }) => {
      if (item.status === 'progress') {
        onProgress?.({ state: 'downloading', progress: item.progress });
      }
    };
    const options = {
      device,
      dtype: spec.dtype,
      progress_callback,
      session_options: SESSION_OPTIONS,
    } as const;

    if (spec.key === 'gemma') {
      const tokenizer: PreTrainedTokenizer = await AutoTokenizer.from_pretrained(
        spec.id,
        { progress_callback },
      );
      const model: PreTrainedModel = await AutoModel.from_pretrained(spec.id, options);
      return async (text: string) => {
        const inputs = await tokenizer([text], { padding: true });
        const output = (await model(inputs)) as {
          sentence_embedding: { data: Float32Array };
        };
        return normalize(output.sentence_embedding.data.slice());
      };
    }

    const pipe: FeatureExtractionPipeline = await pipeline<'feature-extraction'>(
      'feature-extraction',
      spec.id,
      options,
    );
    return async (text: string) => {
      const output = await pipe([text], { pooling: 'mean', normalize: true });
      return normalize((output.data as Float32Array).slice());
    };
  }

  /**
   * A runtime can load, report ready, and return confident nonsense — q8 on
   * WebGPU did. The gap between a related and an unrelated pair is what
   * collapses when it happens, and unlike absolute scores it is comparable
   * across models.
   */
  async #probe(
    spec: ModelSpec,
    embed: EmbedOne,
  ): Promise<{ ok: boolean; near: number; far: number }> {
    // Sequential: one session, and a score must not depend on what ran beside it.
    const anchor = await embed(formatTopic(PROBE.anchor, spec));
    const near = await embed(formatPost(PROBE.near, spec));
    const far = await embed(formatPost(PROBE.far, spec));
    if (!anchor || !near || !far) return { ok: false, near: NaN, far: NaN };
    const nearScore = cosine(anchor, near);
    const farScore = cosine(anchor, far);
    return {
      ok: nearScore >= spec.probeMinNear && nearScore - farScore >= spec.probeMinGap,
      near: nearScore,
      far: farScore,
    };
  }

  /** The probe against the loaded model, for tests and diagnostics. */
  async selfCheck(): Promise<{ ok: boolean; near: number; far: number }> {
    if (!this.#embed || !this.#spec) throw new Error('embedder used before load()');
    return this.#probe(this.#spec, this.#embed);
  }

  /**
   * One text per model call: quantized activations move with the batch, so a
   * batched score would depend on its neighbours. Measured on this model too —
   * batching is no faster and not identical. See wiki-llm/model.md §Determinism.
   */
  async embed(texts: readonly string[]): Promise<Vector[]> {
    const embed = this.#embed;
    if (!embed) throw new Error('embedder used before load()');
    const vectors: Vector[] = [];
    for (const text of texts) vectors.push(await embed(text));
    return vectors;
  }
}
