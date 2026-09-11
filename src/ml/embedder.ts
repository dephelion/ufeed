import { env, pipeline, type FeatureExtractionPipeline } from '@huggingface/transformers';
import type { Backend } from '../core/protocol';
import { normalize, type Vector } from './scoring';

export const MODEL_ID = 'Xenova/all-MiniLM-L6-v2';

/** Model weights come from the CDN; the runtime itself ships with the extension. */
env.allowLocalModels = false;
if (env.backends.onnx.wasm) env.backends.onnx.wasm.wasmPaths = '/ort/';

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

  async load(onProgress?: (p: EmbedderProgress) => void): Promise<Backend> {
    if (this.#pipe) return this.#backend!;

    const report = (item: { status?: string; progress?: number }) => {
      if (item.status === 'progress') {
        onProgress?.({ state: 'downloading', progress: item.progress });
      }
    };

    for (const device of ['webgpu', 'wasm'] as const) {
      try {
        this.#pipe = await pipeline<'feature-extraction'>('feature-extraction', MODEL_ID, {
          device,
          dtype: 'q8',
          progress_callback: report,
        });
        this.#backend = device;
        break;
      } catch (error) {
        if (device === 'wasm') throw error;
      }
    }

    onProgress?.({ state: 'warming' });
    await this.embed(['warm']);
    onProgress?.({ state: 'ready' });
    return this.#backend!;
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
