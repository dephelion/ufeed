# Lensing

Pick your topics. Everything else in your feed gets blurred — still there, one
click away. The model runs entirely on your device; no post text ever leaves it.

Chrome and Firefox, MV3, no backend.

## Requirements

Node 20+ and npm. Nothing else — the ONNX runtime is copied out of
`node_modules` on install, and the model downloads itself on first use.

```bash
npm install
```

## Run it

```bash
npm run watch            # build on change -> .output/chrome-mv3
```

Then load the build and hit reload in the browser after each rebuild.

```bash
npm run build            # one-off -> .output/chrome-mv3
npm run build:firefox    # one-off -> .output/firefox-mv3
```

### Why not `npm run dev`

WXT's dev server serves entrypoint modules from `http://localhost:3001`. The
engine page then creates its worker from that origin, which is **cross-origin to
the extension**, so `new Worker()` throws and the engine never starts — silently,
because nothing else fails. `npm run watch` produces a real production build on
every change instead. Slower by about a second, and it actually runs.

`npm run dev` is still useful for popup-only work, where no worker is involved.

**Chrome** — `chrome://extensions`, turn on Developer mode, *Load unpacked*,
pick `.output/chrome-mv3`.

**Firefox** — `about:debugging#/runtime/this-firefox`, *Load Temporary Add-on*,
pick `.output/firefox-mv3/manifest.json`.

Then open the toolbar popup, add a topic (`tech, software, ai` — one per line),
and visit x.com.

### Watching it work

Every layer logs to the console, prefixed `[lensing:*]`. Post text is never
logged — counts, scores, states and errors only.

```
[lensing:content] content script started host=x.com adapter=x topics=1 active=true
[lensing:client]  injecting engine iframe src=chrome-extension://.../engine.html
[lensing:engine]  engine page loaded origin=chrome-extension://...
[lensing:worker]  loading model
[lensing:worker]  ready backend=webgpu
[lensing:worker]  scored posts=16 msPerPost=12 max=0.244
[lensing:content] batch applied posts=16 blurred=13 strictness=0.06
```

The first missing line locates the failure. `content` and `client` lines appear in
the page console; `engine` and `worker` lines come from the iframe, so pick the
`engine.html` context in the devtools frame selector to see them.

Logging is on while `VITE_LENSING_DEBUG=1` is set in `.env`. Turn it off before
any store submission.

### First run

The model is ~33MB and downloads once, then lives in the browser's cache.
Nothing blurs until it is loaded: a broken or slow engine always reveals rather
than leaving you with a blurred wall. Check the popup's status dot to see where
it is.

## Test

```bash
npm test                 # unit tests, no browser, no network
npm run test:watch
npm run compile          # tsc --noEmit
```

Full check before committing:

```bash
npm run compile && npm test && npm run build && npm run build:firefox
```

```bash
npm run test:model       # the real model on real feed text, ~3s
```

Tests never touch the network or a live feed. Site adapters run against captured
fixture HTML, because vendor DOM changes should fail as a red test rather than a
silent no-op in production.

What no test covers: model loading, WebGPU init, and real scoring in a browser.
A green suite is not a working extension — load a build and watch the popup
status. See [`wiki-llm/testing.md`](wiki-llm/testing.md).

## Layout

```
src/
  ml/          the model, scoring (pure), and the only transformers.js import
  core/        message protocol, score cache, settings, logging
  adapters/    per-site DOM knowledge; X today
  content/     host-page logic: blur controller, engine client
  entrypoints/ content script, engine iframe + worker, background, popup
  ui/          blur stylesheet
public/ort/    ONNX runtime, synced from node_modules by scripts/sync-ort.mjs
wiki-llm/      source of truth
specs/         superseded design docs, provenance only
spikes/        throwaway harnesses and captured data
```

Inference runs in a hidden extension-origin iframe — not the page, not the
service worker. `wiki-llm/architecture.md` explains why that is the only
portable option.

## Source of truth

[`wiki-llm/`](wiki-llm/index.md) — start at the index, which routes to the page
that answers your question. Agent rules are in [`AGENTS.md`](AGENTS.md).
[`specs/v1-spec.md`](specs/v1-spec.md) is the superseded design doc, kept for
provenance; several of its decisions were overturned by measurement.
