/* Keeps bundled ORT binaries in step with the installed onnxruntime-web. */
import { copyFileSync, mkdirSync } from 'node:fs';

/* jsep only: it serves both WebGPU and the CPU fallback. Threads are unusable
   anyway (no cross-origin isolation, spec.md §12.1). */
const FILES = [
  'ort-wasm-simd-threaded.jsep.wasm',
  'ort-wasm-simd-threaded.jsep.mjs',
];

mkdirSync('public/ort', { recursive: true });
for (const file of FILES) {
  copyFileSync(`node_modules/onnxruntime-web/dist/${file}`, `public/ort/${file}`);
}
console.log(`synced ${FILES.length} ORT files`);
