/* Keeps bundled ORT binaries in step with the installed onnxruntime-web. */
import { copyFileSync, mkdirSync, rmSync } from 'node:fs';

/* asyncify only: the onnxruntime-web/webgpu entry transformers.js imports asks for it by name.
   Threads are unusable anyway (no cross-origin isolation, wiki-llm/manifest.md). */
const FILES = [
  'ort-wasm-simd-threaded.asyncify.wasm',
  'ort-wasm-simd-threaded.asyncify.mjs',
];

// Emptied first: public/ is copied whole, so a runtime file left from an older ORT ships too.
rmSync('public/ort', { recursive: true, force: true });
mkdirSync('public/ort', { recursive: true });
for (const file of FILES) {
  copyFileSync(`node_modules/onnxruntime-web/dist/${file}`, `public/ort/${file}`);
}
console.log(`synced ${FILES.length} ORT files`);
