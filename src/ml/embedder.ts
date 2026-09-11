import { env, pipeline, type FeatureExtractionPipeline } from '@huggingface/transformers';
import type { Backend } from '../core/protocol';
import { logger } from '../core/log';
import { MODEL, PROBE, formatPost, formatTopic } from './models';
import { cosine, normalize, type Vector } from './scoring';

const log = logger('embedder');


/** Model weights come from the CDN; the runtime itself ships with the extension. */
env.allowLocalModels = false;
if (env.backends.onnx.wasm) env.backends.onnx.wasm.wasmPaths = '/ort/';

export type Device = 'webgpu' | 'wasm' | 'cpu';

const FORCED = import.meta.env.VITE_LENSING_BACKEND as Device | undefined;

/** Browser order. Node offers only cpu, which is why this is a parameter. */
export const BROWSER_DEVICES: readonly Device[] =
  FORCED ? [FORCED] : ['webgpu', 'wasm'];

export interface EmbedderProgress {
  state: 'downloading' | 'warming' | 'ready';
  progress?: number;
}

export class Embedder {
  #pipe: FeatureExtractionPipeline | undefined;
  #backend: Backend | undefined;

  get backend(): Backend | undefined {
    return this.#backend;
  }

  async load(
    onProgress?: (p: EmbedderProgress) => void,
    devices: readonly Device[] = BROWSER_DEVICES,
  ): Promise<Backend> {
    if (this.#pipe) return this.#backend!;

    const report = (item: { status?: string; progress?: number }) => {
      if (item.status === 'progress') {
        onProgress?.({ state: 'downloading', progress: item.progress });
      }
    };

    const started = Date.now();
    const failures: string[] = [];

    for (const device of devices) {
      try {
        log.info('trying backend', { device, model: MODEL.id });
        this.#pipe = await pipeline<'feature-extraction'>('feature-extraction', MODEL.id, {
          device,
          dtype: 'q8',
          progress_callback: report,
        });

        onProgress?.({ state: 'warming' });
        const probe = await this.selfCheck();
        if (!probe.ok) {
          failures.push(`${device}: wrong vectors (near=${probe.near.toFixed(3)} far=${probe.far.toFixed(3)})`);
          log.warn('backend returns wrong vectors, rejecting', {
            device,
            near: probe.near.toFixed(3),
            far: probe.far.toFixed(3),
          });
          this.#pipe = undefined;
          continue;
        }

        this.#backend = device === 'webgpu' ? 'webgpu' : 'wasm';
        log.info('model loaded', {
          backend: this.#backend,
          ms: Date.now() - started,
          near: probe.near.toFixed(3),
          far: probe.far.toFixed(3),
        });
        onProgress?.({ state: 'ready' });
        return this.#backend;
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        failures.push(`${device}: ${reason}`);
        log.warn('backend unavailable', { device, reason });
        this.#pipe = undefined;
      }
    }

    throw new Error(`no usable backend (${failures.join(' | ')})`);
  }

  /**
   * A backend can load, report ready, and return confident nonsense — q8 on
   * WebGPU does. The gap between a related and an unrelated pair is what
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
      ok: nearScore >= MODEL.probeMinNear
        && nearScore - farScore >= MODEL.probeMinGap,
      near: nearScore,
      far: farScore,
    };
  }

  async embed(texts: readonly string[]): Promise<Vector[]> {
    if (!this.#pipe) throw new Error('embedder used before load()');
    if (texts.length === 0) return [];
    const output = await this.#pipe(texts as string[], { pooling: 'mean', normalize: true });
    const [rows, dims] = output.dims as [number, number];
    const flat = output.data as Float32Array;
    const vectors: Vector[] = [];
    for (let r = 0; r < rows; r++) {
      vectors.push(normalize(flat.slice(r * dims, (r + 1) * dims)));
    }
    return vectors;
  }
}
