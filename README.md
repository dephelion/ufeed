# uFeed

[![CI](https://github.com/dephelion/ufeed/actions/workflows/ci.yml/badge.svg)](https://github.com/dephelion/ufeed/actions/workflows/ci.yml)

**Name the topics you want. uFeed blurs the rest of your feed.**

A browser extension for X, LinkedIn and Reddit, on Chrome and Firefox. The model
runs on your device. No account, no server, no cloud AI, and no post text ever
leaves your browser.

On Chrome, the multilingual model uses one shared offscreen engine across feed
tabs; Firefox and the default English model keep the per-tab iframe engine. Both
paths score on-device and keep page access in the content script.

## The idea

<img width="3900" height="840" alt="feed-showcase-side-by-side-black" src="https://github.com/user-attachments/assets/9352db65-f6f0-47d1-8445-1aa01a643578" />

Most feed filters ask what you want to get rid of. That list never ends: there is
always one more thing to block.

Choose what you want to keep, block, or both. To keep posts about subjects you
care about, add topics one per line:

```
software engineering, programming
machine learning research
video games, game design
```

Posts about your topics stay as you scroll; other posts are blurred, not deleted.
You can also add words or phrases to a keyword blacklist, which blurs matching
posts. The blacklist works by itself or alongside topics. With only a blacklist,
posts without a match stay visible. One click (or Enter) reveals a blurred post.

## Why uFeed

- **Choose what to filter.** Use topics to keep posts about subjects you care
  about, a keyword blacklist to blur posts containing words or phrases you
  choose, or both.
- **Your feed stays on your device.** A small model (33 MB by default) runs inside
  your browser. Feed text and settings are never sent. On a new Chrome install (Firefox does not), the browser opens a welcome page on ufeed.es; the normal page request reveals your
  IP address and language path to the site host. The model is downloaded once
  from Hugging Face, and the source is here so you can check how it works.
- **English by default, every language if you ask.** The default model reads
  English. Pick the multilingual one in the popup and it reads every language and
  sorts more accurately, for a one-time 197 MB download and more work on every
  post. Your topics and settings carry over, and each model keeps its own thumb
  ratings.
- **In your language.** The popup and the labels follow your browser's language,
  and the flag next to the title switches both to another: English, Spanish,
  German, French, Brazilian Portuguese, Japanese and Chinese (Simplified and
  Traditional).
- **You can see why, and steer it.** A 0–10 strictness slider, an option to show
  every post's score, a peek strip that keeps close calls readable, and thumbs
  that correct near-copies of posts you rated.
- **You stay in charge.** A blurred post is always one click, or one Enter, away. If anything
  breaks, the feed shows instead of staying blurred.

## What it cannot do

- **It reads words, not pictures.** A photo with no caption cannot be judged on
  content. The default model also reads English only, so a post in another
  language gets a meaningless score; the multilingual model reads every language.
- **It matches subjects, not quality.** A great post and a poor one about the same
  thing both stay.
- **It is not perfect.** Stricter settings blur more, including some posts you
  would have wanted.

### The trade-off

uFeed compares the meaning of a post with your topics. It does not reason about
the post. A large model in the cloud can judge things like sarcasm or "AI news but
not hype" better than a model small enough for your laptop can. uFeed gives up some of
that in exchange for privacy, speed, and a filter that behaves the same way every
time, so a wrong call can be explained and corrected.
[How it works](docs/how-it-works.md) has the reasoning.

## Install

**Chrome** — [Chrome Web Store](https://chromewebstore.google.com/detail/ahlojbckjlffcfdhmkjepaglnhhpmdck).

**Firefox** — build from source for now (below).

Then open the toolbar popup, add a topic, and visit x.com, linkedin.com or
reddit.com. The model downloads once (~33 MB) and is cached by the browser.
Nothing blurs until it has loaded. If your feed is not in English, choose _Every
language_ under _Model_ in the popup instead (a one-time ~197 MB download).

## Build from source

Node 22.12+ and npm. Nothing else.

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
npm run check            # format, typecheck, tests, both builds
```

Tests never touch the network or a live feed. Site adapters run against captured
fixture HTML, so a vendor DOM change fails as a red test instead of a silent
no-op in production.

## Beautifully architected, easy to extend

```
┌─ entrypoints/ ─────────────────────────────────────────────────────────────┐
│  wires: content · popup · background · iframe · offscreen engine           │
│  ┌─ adapters/ · platform/ ──────────────────────────────────────────────┐  │
│  │  X · LinkedIn · Reddit       storage · messaging · model runtime     │  │
│  │  ┌─ feed/ ────────────────────────────────────────────────────────┐  │  │
│  │  │  the page: find posts, score them, blur, reveal                │  │  │
│  │  │  ┌─ core/ ──────────────────────────────────────────────────┐  │  │  │
│  │  │  │  the rules: scoring · blur policy · settings             │  │  │  │
│  │  │  └──────────────────────────────────────────────────────────┘  │  │  │
│  │  └────────────────────────────────────────────────────────────────┘  │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────────┘
imports point inward only
```

uFeed follows the Dependency Rule from [Clean Architecture](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html): imports only point inward.
The rules in `core/` know nothing of the browser, and the page logic in `feed/` knows nothing of the extension, so a new site never touches the filter.
`npm run check` fails any import that points outward; [`wiki-llm/layers.md`](wiki-llm/layers.md) says where new code goes.

Execution stays separate from these code layers: the content script reads and
updates the feed DOM; the iframe runs the per-tab engine; Chrome's offscreen page
runs one shared Gemma engine. The background creates that page and connects tabs;
it does not score posts. Firefox and Chrome's English model use the iframe path.

## Read more

- [`docs/how-it-works.md`](docs/how-it-works.md) — where it runs, the model, and
  every control, in plain language.
- [`docs/development.md`](docs/development.md) — running, debugging and testing.
- [`docs/android.md`](docs/android.md) — Firefox for Android.
- [`docs/privacy-policy.md`](docs/privacy-policy.md) — what it reads, stores and sends.
- Found a bug or have an idea? [Open an issue](https://github.com/dephelion/ufeed/issues/new/choose).
  Want to change the code? Read [`CONTRIBUTING.md`](CONTRIBUTING.md). Security or
  privacy problem? [`SECURITY.md`](SECURITY.md) says how to report it privately.
- [`wiki-llm/`](wiki-llm/index.md) — the authoritative model of the code. Start at
  the index. Agent rules are in [`AGENTS.md`](AGENTS.md).

## License

Copyright © 2026 Dephelion - Julio Cesar Martin. [GPL-3.0](LICENSE).

Use it, change it, share it. If you distribute a modified version, you must
publish its source under the same license.

The models are not part of this repository and carry their own terms. Your browser
downloads the one you pick from Hugging Face: e5-small-v2 is MIT-licensed, and
EmbeddingGemma is under Google's [Gemma Terms of Use](https://ai.google.dev/gemma/terms).
