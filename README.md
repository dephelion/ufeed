# FeedLens

[![CI](https://github.com/dephelion/feedlens/actions/workflows/ci.yml/badge.svg)](https://github.com/dephelion/feedlens/actions/workflows/ci.yml)

**Name the topics you want. FeedLens blurs the rest of your feed.**

A browser extension for X, LinkedIn and Reddit, on Chrome and Firefox. The model
runs on your device. No account, no server, no cloud AI, and no post text ever
leaves your browser.

## The idea

Most feed filters ask what you want to get rid of. That list never ends: there is
always one more thing to block.

FeedLens asks the opposite question. You write a few topics, one per line:

```
software engineering, programming
machine learning research
video games, game design
```

Each post is compared with them as you scroll. Posts about your topics stay.
Everything else is blurred, not deleted, and one click reveals it.

## Why FeedLens

- **Start from what you want.** Three lines is a full setup. There is no
  blocklist to keep up with.
- **Nothing leaves your device.** A 33 MB model runs inside your browser. There is
  no cloud mode, because there is no server. The only network request is the
  one-time model download, and the source is here so you can check that.
- **You can see why, and steer it.** A 0–10 strictness slider, an option to show
  every post's score, a peek strip that keeps close calls readable, and thumbs
  that correct near-copies of posts you rated.
- **You stay in charge.** A blurred post is always one click away. If anything
  breaks, the feed shows instead of staying blurred.

## What it cannot do

- **It reads English words, not pictures.** A photo with no caption cannot be
  judged on content, and a post in another language gets a meaningless score.
- **It matches subjects, not quality.** A great post and a poor one about the same
  thing both stay.
- **It is not perfect.** Stricter settings blur more, including some posts you
  would have wanted.

### The trade-off

FeedLens compares the meaning of a post with your topics. It does not reason about
the post. A large model in the cloud can judge things like sarcasm or "AI news but
not hype" better than a 33 MB model on your laptop can. FeedLens gives up some of
that in exchange for privacy, speed, and a filter that behaves the same way every
time, so a wrong call can be explained and corrected.
[How it works](docs/how-it-works.md) has the reasoning.

## Install

**Chrome** — [Chrome Web Store](https://chromewebstore.google.com/detail/ahlojbckjlffcfdhmkjepaglnhhpmdck).

**Firefox** — build from source for now (below).

Then open the toolbar popup, add a topic, and visit x.com, linkedin.com or
reddit.com. The model downloads once (~33 MB) and is cached by the browser.
Nothing blurs until it has loaded.

## Build from source

Node 20+ and npm. Nothing else.

```bash
npm install
npm run build            # -> .output/chrome-mv3 and .output/firefox-mv3
```

**Chrome** — `chrome://extensions`, turn on Developer mode, _Load unpacked_, pick
`.output/chrome-mv3`.

**Firefox** — `about:debugging#/runtime/this-firefox`, _Load Temporary Add-on_,
pick `.output/firefox-mv3/manifest.json`.

Working on it? Use `npm run watch` instead of `npm run dev`, and see
[`docs/development.md`](docs/development.md) for why.

```bash
npm run format:check && npm run compile && npm test && npm run build
```

Tests never touch the network or a live feed. Site adapters run against captured
fixture HTML, so a vendor DOM change fails as a red test instead of a silent
no-op in production.

## Layout

```
src/
  ml/          the model, scoring (pure), and the only transformers.js import
  core/        message protocol, score cache, settings, logging
  adapters/    per-site DOM knowledge: X, LinkedIn, Reddit
  feed/        host-page logic: scanner, blur, engine client
  entrypoints/ content script, engine iframe + worker, background, popup
public/ort/    ONNX runtime, synced from node_modules by scripts/sync-ort.mjs
docs/          for people: how it works, development, privacy policy, store copy
wiki-llm/      source of truth for agents
specs/         superseded design docs, provenance only
```

## Read more

- [`docs/how-it-works.md`](docs/how-it-works.md) — the three layers, the model, and
  every control, in plain language.
- [`docs/development.md`](docs/development.md) — running, debugging and testing.
- [`docs/android.md`](docs/android.md) — Firefox for Android.
- [`docs/privacy-policy.md`](docs/privacy-policy.md) — what it reads, stores and sends.
- Found a bug or have an idea? [Open an issue](https://github.com/dephelion/feedlens/issues/new).
- [`wiki-llm/`](wiki-llm/index.md) — the authoritative model of the code. Start at
  the index. Agent rules are in [`AGENTS.md`](AGENTS.md).

## License

Copyright © 2026 Dephelion. [GPL-3.0](LICENSE). Use it, change it, share it. If
you distribute a modified version, you must publish its source under the same
license.
