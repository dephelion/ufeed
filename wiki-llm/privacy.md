# Privacy, Store & Legal

> **Maintenance Invariant:** Data handling, store requirements, legal posture. Any change here is a release-blocking change. Update in the SAME commit as anything touching storage, network, or logging. Token-optimized: imperative, no prose, no redundancy.
> **Answers:** What is read, stored, transmitted. What ships to a store. Where the legal exposure actually is.

## Data

| Data          | Where it goes                                                                                                                   |
| :------------ | :------------------------------------------------------------------------------------------------------------------------------ |
| Post text     | Read from the DOM, embedded in the worker, discarded. Never persisted, never transmitted, never logged.                         |
| Scores        | In-memory LRU keyed by text hash, cleared on reload.                                                                            |
| Settings      | `storage.local`. Topics, blacklist keywords, strictness step, the checkboxes, the language picked in the popup (a locale code). |
| Model weights | Fetched once from the CDN, cached by the browser. Only the model the reader selected is ever fetched.                           |
| Corrections   | Embeddings of thumbed posts, `storage.local`, keyed by model id then topic line and post hash. Vectors only, 50 each way.       |

**Corrections persist as vectors, and that is a real softening, not a technicality.** An embedding is a derivative of post content and is partially invertible, so storing one is not the same as storing nothing. Post text itself still never persists, transmits or logs.

**Settled for the first public release: kept, on these terms.** Opt-in and off by default, so the untouched install stores nothing. Capped at `MAX_PER_CLASS = 50` each way per topic line, oldest off first. Local only, never synced, never transmitted; the reader can export them to a file themselves, see below. Cleared by "Clear tuning", by Reset, and by uninstalling. `docs/privacy-policy.md` states the partial invertibility plainly rather than calling an embedding anonymous — a policy that oversells is worse than the storage it describes.

**Corrections are scoped to the topic line that produced them.** Editing a line discards its corrections rather than applying them to a query they were never about.

**Nothing is stored until the user opts in.** `tuneFromFeedback` is off by default; with it off the thumbs are hidden and no vector is written. "Clear tuning", under "Learn from my thumbs" in the popup, deletes every correction, and Reset does the same.

**Export writes those vectors to a file the reader chooses.** Settings and corrections leave as one JSON file and come back the same way, on the reader's click and no other trigger — no automatic export, no scheduled backup, no cloud target, ever. The extension still transmits nothing; what changes is that a partially invertible derivative of read posts can now sit in a synced folder. **The policy carries that disclosure, not the popup** — [`docs/privacy-policy.md`](../docs/privacy-policy.md) and the published page say what the file holds rather than calling it anonymous; the popup hint says only what the buttons do. Import replaces what is stored, and refuses a file from another model whole (see [architecture.md](architecture.md)).

**`storage.sync` was rejected for this.** 100KB total and 8KB per item cannot hold one topic's vectors, and it would ship a reader's topics to a browser vendor's server — a backend nobody chose.

**Engine status is asked, never stored.** The popup queries the active tab over `browser.runtime` messaging and keeps the answer in memory. An earlier version parked it in `storage.local` with a timestamp, which left a durable record of when a feed was last open — settings-adjacent, surviving restarts, and flatly at odds with the claim above. Nothing about engine activity now touches disk. See [architecture.md](architecture.md).

**One class of network request exists: model weights.** Nothing else. No analytics in v1 — a hard constraint, and what makes the "does not collect user data" declaration truthful.

**Choosing a model does not tell anyone anything more.** Both come from `huggingface.co` and its storage CDN, on the same one-time fetch, with no identifier attached. Picking the multilingual one changes which files are requested and nothing else; the selection itself stays in `storage.local` and is never transmitted.

**Never log post text.** `src/core/log.ts` takes counts, scores, states, errors and topic strings. Topic strings are user config. Post text is not, and a console log reaches devtools recordings and crash reports.

## Before a store submission

Listing copy, permission justifications and the data-disclosure answers live in [`docs/store-listing.md`](../docs/store-listing.md); the policy itself in [`docs/privacy-policy.md`](../docs/privacy-policy.md).

- [ ] `npm run build` — debug logs and score badges compiled out.
- [ ] Privacy policy live at https://dephelion.com/ufeed-browser-extension/privacy/ and pasted into the dashboard.
- [ ] Screenshots (1280x800 or 640x400), at least one.
- [ ] Load `.output/chrome-mv3` unpacked in a cold profile and walk install -> topic -> first score. No suite covers it.
- [ ] Network tab clean on that run: `GET` model files from `huggingface.co` and its storage CDN (`*.hf.co`, reached by redirect) only. A `cdn.jsdelivr.net` WASM fetch is remote code execution and a rejection.
- [ ] AMO source bundle: unminified source plus reproducible build instructions. Bundled ONNX/WASM binaries make this mandatory. Firefox only.
- [ ] ORT `.wasm` bundled locally, never CDN.
- [ ] No platform trademarks in the extension title.
- [ ] Single purpose held: topic-based content blurring, nothing else.

## Legal posture

Client-side DOM modification by user-installed extensions is widespread and generally tolerated. The exposure is **platform terms of service**, not copyright: X's terms restrict automated access to and modification of the service, and extensions that alter X have drawn enforcement attention.

A product risk to monitor, not a settled question. Get counsel before any commercial launch.
