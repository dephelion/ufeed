# Lensing

[![CI](https://github.com/juliomatcom/lensing/actions/workflows/ci.yml/badge.svg)](https://github.com/juliomatcom/lensing/actions/workflows/ci.yml)

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
npm run build            # one-off -> .output/chrome-mv3 and .output/firefox-mv3
npm run build:firefox    # one-off, Firefox only -> .output/firefox-mv3
```

### Why not `npm run dev`

WXT's dev server serves entrypoint modules from `http://localhost:3001`. The
engine page then creates its worker from that origin, which is **cross-origin to
the extension**, so `new Worker()` throws and the engine never starts — silently,
because nothing else fails. `npm run watch` produces a real production build on
every change instead. Slower by about a second, and it actually runs.

`npm run dev` is still useful for popup-only work, where no worker is involved.

**Chrome** — `chrome://extensions`, turn on Developer mode, _Load unpacked_,
pick `.output/chrome-mv3`.

**Firefox** — `about:debugging#/runtime/this-firefox`, _Load Temporary Add-on_,
pick `.output/firefox-mv3/manifest.json`.

**Firefox for Android** — see [`docs/android.md`](docs/android.md); it needs
Nightly on both ends and a different loading path.

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
[lensing:worker]  ready backend=wasm
[lensing:worker]  scored posts=16 msPerPost=12 max=0.244
[lensing:content] batch applied posts=16 blurred=13 strictness=0.06
```

WebGPU is tried first and rejected by the self-check on the way past — ORT
miscomputes the q8 weights there — so `backend=wasm` is the expected steady
state, and the rejection prints at `info`, not as a warning.

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
npm run format:check && npm run compile && npm test && npm run build
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
```

Inference runs in a hidden extension-origin iframe — not the page, not the
service worker. `wiki-llm/architecture.md` explains why that is the only
portable option.

## How it works

Lensing has three layers, and each has one job. The **content script** runs in
the page: it reads posts and applies the blur. A **hidden extension iframe**
passes messages along. A **worker thread** runs the model, so scoring never
blocks scrolling. Only strings go in and scores come out, which keeps post text
on your device. The full version, with diagrams, is in
[`docs/how-it-works.md`](docs/how-it-works.md).

### What the model does

**e5-small-v2** is a text embedding model from Microsoft
([E5 paper](docs/2212.03533v2.pdf)). It turns text into a vector, so that texts
about the same thing end up close together. Each topic line is embedded as
`query:` and each post as `passage:`, and a post's score is its highest cosine
against any topic line. E5 learned from web pairs such as a question and its
answer, so it needs no training on your topics. Its training also packs scores
into a narrow band. It reads English only, and it never sees images.
[Full section](docs/how-it-works.md#what-the-model-does).

### Inside the worker

transformers.js splits the text into tokens and averages the model's output
into one vector of length 1. The ONNX Runtime executes the model on its WASM
backend. WebGPU is tried first, but a self-check rejects it because it
miscomputes the quantized weights. The model weights download once from the
hub CDN and are then cached. The runtime WASM ships inside the extension and is
never fetched. [Full section](docs/how-it-works.md#inside-the-worker).

### Tuning it yourself

The model never changes. Every control moves either the query vector or the
threshold. **Topic words** set the query, and plain words beat category names.
**Strictness** picks a measured threshold within that narrow score band. A
**peek strip** just below the threshold keeps close calls readable. **Thumbs**
(off by default) move the query toward posts you kept and away from ones you
blurred, using Rocchio relevance feedback. Once a topic line has a thumb, its
threshold is set relative to that line's own recent scores.
[Full section](docs/how-it-works.md#tuning-it-yourself).

### What a thumb changes

A thumb corrects only the topic line that gave the post its score. Rating the
same post again removes the rating, and the other thumb flips it. No single word
is picked out: the whole post is one vector. Rewriting a line discards its
corrections, and the other lines keep theirs.
[Full section](docs/how-it-works.md#what-a-thumb-changes).

Full reasoning in [`wiki-llm/architecture.md`](wiki-llm/architecture.md), model
detail in [`wiki-llm/model.md`](wiki-llm/model.md), terms in
[`wiki-llm/glossary.md`](wiki-llm/glossary.md).

## Source of truth

[`wiki-llm/`](wiki-llm/index.md) — start at the index, which routes to the page
that answers your question. Agent rules are in [`AGENTS.md`](AGENTS.md).
[`specs/v1-spec.md`](specs/v1-spec.md) is the superseded design doc, kept for
provenance; several of its decisions were overturned by measurement.
