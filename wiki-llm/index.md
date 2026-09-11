# wiki-llm — Lensing Source of Truth & Routing Index

> **Maintenance Invariant:** Routing table only. One row per page. Prohibit orphan pages. Prohibit content here — content lives in the page. Update this row set in the SAME commit as any new/renamed page.
> **Answers:** Which wiki page answers my question?

Lensing is a browser extension that blurs off-topic posts in social feeds. The user names topics; an embedding model scores each post on-device; anything below the threshold is blurred, never removed, and one click reveals it. No backend, no account, no post text leaves the device.

Chrome and Firefox, MV3, built with WXT. v1 targets X.

| Page                               | Answers                                                                                                              |
| :--------------------------------- | :------------------------------------------------------------------------------------------------------------------- |
| [architecture.md](architecture.md) | What are the three layers, why does the iframe exist, how does a post become a blur, what crosses each boundary?     |
| [model.md](model.md)               | Which model, why that one, what do the scores mean, how is the threshold set, why does a backend get rejected?       |
| [adapters.md](adapters.md)         | How is a post found in a vendor DOM? X selectors, virtualized recycling, what breaks when the vendor ships a change. |
| [ui.md](ui.md)                     | What the blur looks like, how a post is revealed, what the popup controls, what debug mode adds.                     |
| [manifest.md](manifest.md)         | Permissions, CSP, per-browser manifest differences, what must never be dropped.                                      |
| [privacy.md](privacy.md)           | What Lensing reads, what it stores, what leaves the device, store policy, legal posture.                             |
| [testing.md](testing.md)           | Test tiers, what each covers, what no test covers, commands.                                                         |
| [conventions.md](conventions.md)   | Repo layout, toolchain, hard invariants, definition of done, debug builds.                                           |

## Status

**Working end to end on X.** Content script finds posts, scores them through an in-page extension iframe hosting a worker, blurs what falls below the threshold. Popup sets topics, strictness, the advanced score band, and reset.

Resolved by measurement, see [model.md](model.md): iframe WebGPU works on both browsers; e5-small-v2 beats MiniLM and bge; length compensation unnecessary; ORT WebGPU miscomputes the q8 model and is rejected at load.

Not built: Reddit adapter, Chrome offscreen singleton, multilingual, mobile.

Superseded design doc: [specs/v1-spec.md](../specs/v1-spec.md), kept for provenance only. This wiki is authoritative.

Every number in these pages came from a measurement harness run against a captured timeline. Both live in gitignored `.local/`: the data is personal, and the method is described where the number is used.
