# Privacy, Store & Legal

> **Maintenance Invariant:** Data handling, store requirements, legal posture. Any change here is a release-blocking change. Update in the SAME commit as anything touching storage, network, or logging. Token-optimized: imperative, no prose, no redundancy.
> **Answers:** What is read, stored, transmitted. What ships to a store. Where the legal exposure actually is.

## Data

| Data          | Where it goes                                                                                           |
| :------------ | :------------------------------------------------------------------------------------------------------ |
| Post text     | Read from the DOM, embedded in the worker, discarded. Never persisted, never transmitted, never logged. |
| Scores        | In-memory LRU keyed by text hash, cleared on reload.                                                    |
| Settings      | `storage.local`. Topics, slider position, band, per-host toggles.                                       |
| Model weights | Fetched once from the CDN, cached by the browser.                                                       |
| Corrections   | Embeddings of thumbed posts, `storage.local`. Vectors only, capped at 50 each way.                      |

**Corrections persist as vectors, and that is a real softening, not a technicality.** An embedding is a derivative of post content and is partially invertible, so storing one is not the same as storing nothing. Post text itself still never persists, transmits or logs. Authorised for the testing phase with no real users; before any public release decide what is stored, how it is cleared, and whether Reset removes it.

**Corrections are scoped to the topics that produced them.** Changing topics discards them rather than applying a correction to a query it was never about.

**One class of network request exists: model weights.** Nothing else. No analytics in v1 — a hard constraint, and what makes the "does not collect user data" declaration truthful.

**Never log post text.** `src/core/log.ts` takes counts, scores, states, errors and topic strings. Topic strings are user config. Post text is not, and a console log reaches devtools recordings and crash reports.

## Before a store submission

- [ ] `npm run build` — debug logs and score badges compiled out.
- [ ] Privacy policy URL (Chrome Web Store requirement).
- [ ] AMO source bundle: unminified source plus reproducible build instructions. Bundled ONNX/WASM binaries make this mandatory.
- [ ] ORT `.wasm` bundled locally, never CDN.
- [ ] No platform trademarks in the extension title.
- [ ] Single purpose held: topic-based content blurring, nothing else.

## Legal posture

Client-side DOM modification by user-installed extensions is widespread and generally tolerated. The exposure is **platform terms of service**, not copyright: X's terms restrict automated access to and modification of the service, and extensions that alter X have drawn enforcement attention.

A product risk to monitor, not a settled question. Get counsel before any commercial launch.
