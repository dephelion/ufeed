# wiki-llm — uFeed Source of Truth & Routing Index

> **Maintenance Invariant:** Routing table only. One row per page. Prohibit orphan pages. Prohibit content here — content lives in the page. Update this row set in the SAME commit as any new/renamed page.
> **Answers:** Which wiki page answers my question?

uFeed is a browser extension that filters social feeds by chosen topics, blocked words or phrases, or both. Topic matches are scored on-device; blacklist matches blur directly. Posts are blurred, never removed, and one click reveals them. No backend, no account, no post text leaves the device.

Chrome and Firefox, MV3, built with WXT. Feeds: X, LinkedIn, Reddit.

| Page                               | Answers                                                                                                                          |
| :--------------------------------- | :------------------------------------------------------------------------------------------------------------------------------- |
| [architecture.md](architecture.md) | Which execution contexts run, why do iframe and offscreen page exist, how does a post become a blur, what crosses each boundary? |
| [layers.md](layers.md)             | Which folder does new code go in, which way may imports point, what enforces the Dependency Rule?                                |
| [model.md](model.md)               | Which model, why that one, what do the scores mean, how is the threshold set, why does a backend get rejected?                   |
| [adapters.md](adapters.md)         | How is a post found in a vendor DOM? X selectors, virtualized recycling, what breaks when the vendor ships a change.             |
| [ui.md](ui.md)                     | What the blur looks like, how a post is revealed, what the popup controls, what debug mode adds.                                 |
| [i18n.md](i18n.md)                 | Where UI text lives, which language a reader gets, how text reaches each surface, what stays English, how to add a language.     |
| [manifest.md](manifest.md)         | Permissions, CSP, per-browser manifest differences, what must never be dropped.                                                  |
| [privacy.md](privacy.md)           | What uFeed reads, what it stores, what leaves the device, store policy, legal posture.                                           |
| [product.md](product.md)           | What is uFeed for, what will it never do, which words may user-facing copy claim.                                                |
| [testing.md](testing.md)           | Test tiers, what each covers, what no test covers, commands.                                                                     |
| [conventions.md](conventions.md)   | Every repo rule, stated once: hard invariants, how to work, code and doc rules, layout, definition of done.                      |
| [glossary.md](glossary.md)         | What does AUC, d-prime, embedding, retrieval model, quantization, etc. mean, in plain language.                                  |

## Status

**Working end to end on X, LinkedIn and Reddit.** Content script finds posts and applies the blur. Chrome shares one offscreen Gemma worker across feed tabs; Firefox uses a per-tab iframe worker. Popup sets topics, strictness, and reset.

Resolved by measurement, see [model.md](model.md): e5-small-v2 beats MiniLM and bge; length compensation unnecessary; ORT WebGPU miscomputes the q8 model, so WASM is the only backend.

Two models, picked in the popup: EmbeddingGemma-300m (197MB, every language, default) and `e5-small-v2` (33MB, English only). Gemma is now fast enough for the default first-run experience; its strictness scale remains provisional.

The UI speaks English, Spanish, German, French, Brazilian Portuguese, Japanese and Chinese (Simplified and Traditional); the browser's language picks one until the reader picks another in the popup, see [i18n.md](i18n.md).

Not built: worker pool, mobile. Chrome's offscreen singleton is implemented for the default Gemma path.

Every number in these pages came from a measurement harness run against a captured timeline. Both live in gitignored `.local/`: the data is personal, and the method is described where the number is used.
