# Development

How to run, debug and test FeedLens locally. For a first build, the
[README](../README.md#build-from-source) is enough; this page is for when you are
changing things.

## Run it

```bash
npm run watch            # build on change -> .output/chrome-mv3
```

Load the build once, then hit reload in the browser after each rebuild.

```bash
npm run build            # one-off -> .output/chrome-mv3 and .output/firefox-mv3
npm run build:firefox    # one-off, Firefox only -> .output/firefox-mv3
```

**Chrome** — `chrome://extensions`, turn on Developer mode, _Load unpacked_, pick
`.output/chrome-mv3`.

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
[feedlens:worker]  scored posts=16 msPerPost=12 max=0.812 rated=0
[feedlens:content] batch applied posts=16 blurred=11 rated=0 threshold=0.790
```

The first missing line locates the failure. `content` and `client` lines appear in
the page console; `engine` and `worker` lines come from the iframe, so pick the
`engine.html` context in the devtools frame selector to see them.

Logging is on in `npm run watch` and `npm run build:debug`, which set
`VITE_FEEDLENS_DEBUG=1` themselves. `npm run build` and the release workflow never
do, so a store build always ships without logs.

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
npm run test:model       # the real model on real feed text, ~3s
```

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

## Release

1. On the release branch, bump the version: `npm version minor --no-git-tag-version`.
2. Merge to `main` through a pull request, with CI green.
3. Run `npm run release`. It switches to `main`, pulls, tags the version in
   `package.json` (`v0.7.0`) and pushes the tag. It stops if that tag already
   exists.

The tag starts the **Release** workflow. It checks that the tag matches `package.json`, runs
`npm run check`, and attaches three zips to a GitHub release: Chrome, Firefox,
and the sources Firefox Add-ons asks for. Upload those to the stores; never a zip
built locally.
