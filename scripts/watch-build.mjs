/* WXT dev serves entrypoint modules from localhost, which makes new Worker()
   cross-origin and throws. Production builds on change instead. */
import { spawn } from 'node:child_process';
import { watch } from 'node:fs';

let timer;
let running = false;
let queued = false;

function build() {
  if (running) {
    queued = true;
    return;
  }
  running = true;
  const started = Date.now();
  const child = spawn('npx', ['wxt', 'build', '--mode', 'debug'], { stdio: 'inherit' });
  child.on('close', (code) => {
    running = false;
    console.log(
      code === 0
        ? `\n  rebuilt in ${Date.now() - started}ms — reload the extension\n`
        : `\n  build failed (${code})\n`,
    );
    if (queued) {
      queued = false;
      build();
    }
  });
}

for (const dir of ['src', 'public']) {
  watch(dir, { recursive: true }, () => {
    clearTimeout(timer);
    timer = setTimeout(build, 250);
  });
}
watch('wxt.config.ts', () => {
  clearTimeout(timer);
  timer = setTimeout(build, 250);
});

console.log('watching src/ — debug build on change');
build();
