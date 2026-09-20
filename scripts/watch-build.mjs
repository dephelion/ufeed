/* WXT dev serves entrypoint modules from localhost, which makes new Worker()
   cross-origin and throws. Production builds on change instead. */
import { spawn } from 'node:child_process';
import { watch } from 'node:fs';

let timer;
let running = false;
let queued = false;

// One after the other: both builds regenerate .wxt/, so running them together races.
const TARGETS = [[], ['-b', 'firefox']];

function run(args) {
  return new Promise((resolve) => {
    spawn('npx', ['wxt', 'build', ...args, '--mode', 'debug'], { stdio: 'inherit' }).on(
      'close',
      resolve,
    );
  });
}

async function build() {
  if (running) {
    queued = true;
    return;
  }
  running = true;
  const started = Date.now();
  let failed = 0;
  for (const args of TARGETS) {
    failed ||= await run(args);
  }
  running = false;
  console.log(
    failed === 0
      ? `\n  rebuilt in ${Date.now() - started}ms — reload the extension\n`
      : `\n  build failed (${failed})\n`,
  );
  if (queued) {
    queued = false;
    build();
  }
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

console.log('watching src/ — debug build (chrome + firefox) on change');
build();
