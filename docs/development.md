# Development

How to run, debug and test FeedLens locally. For a first build, the
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

Every layer logs to the console, prefixed `[feedlens:*]`. Post text is never
logged — counts, scores, states and errors only.

```
[feedlens:content] content script started host=x.com adapter=x topics=1 active=true
[feedlens:client]  injecting engine iframe src=chrome-extension://.../engine.html
[feedlens:engine]  engine starting origin=chrome-extension://...
[feedlens:embedder] loading model device=wasm model=Xenova/e5-small-v2
[feedlens:worker]  ready
[feedlens:worker]  scored posts=5 msPerPost=12 max=0.812 rated=0
[feedlens:content] batch applied posts=5 blurred=3 rated=0 threshold=0.790
```

The `embedder` line names the model: `Xenova/e5-small-v2` by default,
`onnx-community/embeddinggemma-300m-ONNX` once you pick _Every language_ in the
popup.

The first missing line locates the failure. `content` and `client` lines appear in
the page console; `engine` and `worker` lines come from the iframe, so pick the
`engine.html` context in the devtools frame selector to see them.

Logging is on only in debug builds: `npm run watch` and `npm run build:debug`.
The build mode alone decides it, never an environment variable or a
`.env` file, so `npm run build` and `npm run zip` never log. Debug builds go to
their own folder (`.output/chrome-mv3-debug`), apart from the one the store zip
is made from.

### First run

The default model is ~33MB and the multilingual one ~197MB; whichever you pick
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

The first `test:model` run downloads ~197MB for the multilingual model on top of
the default's 33MB. `npm run check` never does.

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
5. Pick it from the flag next to the title in the popup. The labels on posts follow
   the browser's language instead, so to check those set the browser to it (Chrome:
   Settings, Languages, or the system language on macOS; Firefox: Settings,
   Language) and restart. Tests cannot see wrapping.

The score badge, log output and the engine's own error text stay English on
purpose. The reasons are in [`wiki-llm/i18n.md`](../wiki-llm/i18n.md).

## Release

1. On the branch, bump the version: `npm version minor --no-git-tag-version`.
2. Merge it to `main` through a pull request, with CI green.
3. From an up-to-date `main`, build the store zips:

```bash
npm run zip && npm run zip:firefox   # .output/feedlens-<version>-{chrome,firefox,sources}.zip
```

Upload the Chrome zip to the Chrome Web Store, and the Firefox zip plus the
sources zip to Firefox Add-ons.
