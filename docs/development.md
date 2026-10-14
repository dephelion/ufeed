# Development

How to run, debug and test uFeed locally. For a first build, the
[README](../README.md#build-from-source) is enough; this page is for when you are
changing things.

## Run it

```bash
npm run watch            # debug build on change -> .output/chrome-mv3-debug and firefox-mv3-debug
```

Load the build once, then hit reload in the browser after each rebuild.

```bash
npm run build            # one-off -> .output/chrome-mv3 and .output/firefox-mv3
npm run build:firefox    # one-off, Firefox only -> .output/firefox-mv3
```

**Chrome** — `chrome://extensions`, turn on Developer mode, _Load unpacked_, pick
`.output/chrome-mv3-debug` (from `watch`) or `.output/chrome-mv3`.

**Firefox** — `about:debugging#/runtime/this-firefox`, _Load Temporary Add-on_,
pick `.output/firefox-mv3/manifest.json`.

**Firefox for Android** — see [`android.md`](android.md); it needs Nightly on both
ends and a different loading path.

Then open the toolbar popup, add a topic (`tech, software, ai`, one per line), and
visit x.com.

### Why not `npm run dev`

WXT's dev server serves entrypoint modules from `http://localhost:3001`. The
engine page then creates its worker from that origin, which is **cross-origin to
the extension**, so `new Worker()` throws and the engine never starts — silently,
because nothing else fails. `npm run watch` produces a real production build on
every change instead. Slower by about a second, and it actually runs.

`npm run dev` is still useful for popup-only work, where no worker is involved.

## Watching it work

Every layer logs to the console, prefixed `[ufeed:*]`. Post text is never
logged — counts, scores, states and errors only.

```
[ufeed:content] content script started host=x.com adapter=x topics=1 active=true
[ufeed:client]  injecting engine iframe src=chrome-extension://.../engine.html
[ufeed:engine]  engine starting origin=chrome-extension://...
[ufeed:embedder] loading model device=wasm model=onnx-community/embeddinggemma-300m-ONNX
[ufeed:worker]  ready
[ufeed:worker]  scored posts=5 msPerPost=12 max=0.812 rated=0
[ufeed:content] batch applied posts=5 blurred=3 rated=0 threshold=0.790
```

The `embedder` line names the model: `onnx-community/embeddinggemma-300m-ONNX` by
default, or `Xenova/e5-small-v2` after you pick the smaller English model in the
popup.

The first missing line locates the failure. `content` and `client` lines appear in
the page console. For Chrome's default Gemma model, inspect `engine` and `worker`
lines in the offscreen document at `chrome://inspect/#pages`; for the English
model and Firefox, select the `engine.html` iframe in the page DevTools frame
selector. The background service worker logs appear in the extension's
service worker DevTools.

Logging is on only in debug builds: `npm run watch` and `npm run build:debug`.
The build mode alone decides it, never an environment variable or a
`.env` file, so `npm run build` and `npm run zip` never log. Debug builds go to
their own folder (`.output/chrome-mv3-debug`), apart from the one the store zip
is made from.

### Inspect Chrome's shared Gemma worker

Use the Gemma model; Chrome's English model and Firefox use the iframe engine
instead.

1. Build a readable debug extension with `npm run build:debug`, then load
   `.output/chrome-mv3-debug` from `chrome://extensions`.
2. Open a feed tab with topics; the default Gemma model starts the shared engine.
3. Open `chrome://inspect/#pages`. Find uFeed's `offscreen.html` and click
   **Inspect**. If it is absent, the shared Gemma engine has not started yet.
4. In the offscreen DevTools Console, evaluate `crossOriginIsolated`. It should
   be `true`; this confirms the page can use shared WebAssembly memory, but does
   not alone confirm the thread count.
5. In the offscreen DevTools Console, look for
   `[ufeed:embedder] creating WASM threads count=2`, before the model-loading
   line. The embedder is configured for two WASM threads.

Without a retry warning, `count=1` means isolation was unavailable when the
worker started. A `two-thread load failed, retrying single-threaded` warning
means the embedder retries with one thread and logs `count=1`. Open
`chrome://inspect/#pages` to inspect the offscreen page and its worker.

### First run

The default model is ~197MB and the English-only one ~33MB; whichever you pick
downloads once, then lives in the browser's cache. Nothing blurs until it is
loaded: a broken or slow engine always reveals rather than leaving you with a
blurred wall. Loading from the cache takes a few seconds, and posts wait under a
heavier blur marked "Classifying…" meanwhile; a first download holds nothing back
and shows the feed as normal. Check the popup's status dot to see where it is.

## Test

```bash
npm test                 # unit tests, no browser, no network
npm run test:watch
npm run compile          # tsc --noEmit
npm run test:model       # both real models on real feed text, ~6s
```

The first `test:model` run downloads both models, ~197MB for Gemma and ~33MB for
e5-small. `npm run check` never does.

Full check before committing:

```bash
npm run check            # format, typecheck, tests, both builds
```

Tests never touch the network or a live feed. Site adapters run against captured
fixture HTML, because vendor DOM changes should fail as a red test rather than a
silent no-op in production.

What no test covers: model loading and real scoring in a browser.
A green suite is not a working extension — load a build and watch the popup
status. See [`wiki-llm/testing.md`](../wiki-llm/testing.md).

## Add a language

Every word the extension shows lives in `public/_locales/<code>/messages.json`,
one folder per language. The browser picks the folder from its own language and
falls back to English, so nothing else needs wiring.

1. Copy `public/_locales/en` to `public/_locales/<code>`. Use the browser's folder
   name: `de`, `fr`, `pt_BR`, `zh_TW`.
2. Translate each `message`. Keep every `$NAME$` exactly as written, keep
   `extDescription` within 132 characters, and keep the `chip*` messages within 18.
   The `description` fields explain where each line appears.
3. Add it to `LANGUAGES` in `src/core/languages.ts`: its code, a flag, and its
   own name for itself. This is what puts it in the popup's flag menu.
4. Run `npm test`. It fails on a missing key, a lost placeholder, a string that is
   too long, or a language missing from that list.
5. Pick it from the flag next to the title in the popup, then check the labels on
   a feed tab. Tests cannot see wrapping.

The score badge, log output and the engine's own error text stay English on
purpose. The reasons are in [`wiki-llm/i18n.md`](../wiki-llm/i18n.md).

## Release

1. On the branch, bump the version: `npm version minor --no-git-tag-version`.
2. Merge it to `main` through a pull request, with CI green.
3. From an up-to-date `main`, build the store zips:

```bash
npm run zip && npm run zip:firefox   # .output/ufeed-<version>-{chrome,firefox,sources}.zip
```

Upload the Chrome zip to the Chrome Web Store, and the Firefox zip plus the
sources zip to Firefox Add-ons.
