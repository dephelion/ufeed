# Conventions

> **Maintenance Invariant:** Repo rules, layout, toolchain, definition of done. Hard invariants are non-negotiable. Update in the SAME commit as any layout or toolchain change. Token-optimized: imperative, no prose, no redundancy.
> **Answers:** Repo layout. Toolchain. Hard invariants. Definition of done. Build modes.

## Toolchain

| Concern     | Choice                                                        |
| :---------- | :------------------------------------------------------------ |
| Runtime     | Node 20+                                                      |
| Language    | TypeScript, `strict`, `noUncheckedIndexedAccess`, ESM         |
| Framework   | **WXT** — generates both manifests, owns entrypoint discovery |
| Tests       | **Vitest**, `happy-dom` for DOM tiers                         |
| Browser API | `webextension-polyfill`, **promise style only**               |
| Inference   | `@huggingface/transformers` v3 over ONNX Runtime Web          |

## Layout

```
src/
  ml/           models.ts (the one model) · scoring.ts (pure) · embedder.ts (only transformers.js import)
  core/         protocol.ts · cache.ts · settings.ts · feedback.ts · config-transfer.ts · engine-status.ts · status-channel.ts · log.ts · debug.ts
  adapters/     types.ts · x.ts · linkedin.ts · reddit.ts · index.ts
  feed/         runs inside the host feed
                  policy.ts    the blur decision, pure
                  scanner.ts   finds posts, says when one nears the viewport
                  queue.ts     batches to the engine, discards stale replies
                  tuning.ts    corrections and their persistence
                  language.ts  the model's language gate, and CLD detection
                  blur.ts · media.ts · score-badge.ts · feedback-bar.ts · engine-client.ts · blur.css
  entrypoints/  content.ts · engine/ · background.ts · popup/
public/ort/     ONNX runtime, synced by scripts/sync-ort.mjs
wiki-llm/       source of truth
specs/          design docs: one ACTIVE PLAN at most, the rest provenance
```

**`specs/` holds at most one active plan.** There is none right now: v1 through
v4 are all delivered and superseded, and everything in `specs/` is provenance.
A plan there is never authority on current behaviour — each task updates its
owning wiki page in the same commit, and the plan is marked superseded once
delivered. Start a v5 the same way when the next piece of work needs one.

`.local/` is gitignored and holds the measurement harnesses and the captured
timeline data they ran against. The harnesses are reproducible from
[model.md](model.md); the data is personal and never ships.

**Validate anything read back from `storage.local`.** It outlives the shape that wrote it. `normalizeFeedback()` drops what no longer parses instead of trusting it — a stale correction shape reached `.filter` and took the whole content script down before it could blur anything. Spreading defaults over stored JSON (`{ ...DEFAULTS, ...stored }`) checks nothing.

**`entrypoints/content.ts` wires, it does not decide.** Every piece of feed state has an owner: `scanner` what it has seen, `queue` what is in flight, `tuning` the ratings. Logic that grows there belongs in `feed/`.

**The blur decision is pure.** `feed/policy.ts` answers reveal / peek / blur / blur-media / blur-language from settings, text, score, threshold, a detected language and a near-identical rating — no DOM, no element. The caller applies the answer. Fail-open and the tier boundaries are decided there, so they test in milliseconds instead of through happy-dom.

**Nothing the worker imports touches the polyfill.** `ml/`, `core/protocol.ts`, `core/log.ts`: the polyfill throws outside an extension page, and the worker is not one. Tests fake the browser once in `vitest.setup.ts` (WXT's `fakeBrowser`), so storage lives in the same file as the logic it serves; a test file's own `vi.mock` still wins.

## Hard invariants

1. **Privacy.** Post text never leaves the device, never reaches a log, never persists at all. Zero analytics. Only model weights are fetched. **Amended in v2:** embeddings of posts the user explicitly corrected persist in `storage.local`. Vectors only, never text, never transmitted. See [privacy.md](privacy.md).
2. **Fail-open.** Every error, timeout and unready state reveals. No path may leave a post blurred because something broke.
3. **Host page integrity.** All injected CSS namespaced `.lx-*`. No layout side effects beyond the documented `position: relative`. Never mutate host DOM beyond class and `aria-hidden` toggles.
4. **Cross-browser floor.** Every API must work on Chrome MV3 **and** Firefox MV3. Promise-style polyfill only — never callbacks, never an aliased `browser ?? chrome`. Chrome-only paths are optimisations behind a fallback. Sole callback exception: `action.setIcon` in `background.ts` — Chrome logs a stale-tab error as unchecked `runtime.lastError` despite a caught promise.
5. **Main thread.** No inference, embedding or tokenization on the page's main thread.

## Build modes

| Command                 | Output                | Logs | Readable source       |
| :---------------------- | :-------------------- | :--- | :-------------------- |
| `npm run watch`         | `.output/chrome-mv3`  | on   | yes, inline sourcemap |
| `npm run build:debug`   | `.output/chrome-mv3`  | on   | yes, inline sourcemap |
| `npm run build`         | `.output/chrome-mv3`  | off  | no, minified          |
| `npm run build:firefox` | `.output/firefox-mv3` | off  | no, minified          |

**`VITE_FEEDLENS_DEBUG` turns off minification too**, in `wxt.config.ts`. `watch` builds production-shaped output on purpose — that is what keeps `new Worker()` same-origin — but minified output reports every failure as `content.js:1`, which is useless for a stack trace.

**The score badge is a setting, not a build flag.** It ships in every build behind `showScores`; only console logs are compiled out. See [ui.md](ui.md).

**`npm run dev` does not work for engine changes.** WXT serves entrypoint modules from `localhost`, which makes `new Worker()` cross-origin; it throws and the engine never starts, silently. Use `npm run watch`. `dev` is fine for popup-only work.

## Logging

Chrome's extension Errors page collects every `console.warn` and `console.error`, in every build. A handled condition there reads as a broken product.

| Level   | Means                                                              | Prints                       |
| :------ | :----------------------------------------------------------------- | :--------------------------- |
| `info`  | State, progress                                                    | debug builds, `console.info` |
| `warn`  | A condition the code handles: offline, timeout, quota, fallback    | debug builds, `console.info` |
| `error` | A FeedLens bug: an invariant broke, a loaded model failed to embed | every build, `console.error` |

- **Pick `error` only if a user could file it as a bug.** Environment and network failures are `warn`; the popup already shows them.
- **Every async path ends in a handler.** No floating rejection; `unhandledrejection` and worker `error` listeners call `preventDefault()` so the browser does not report the same fault twice.
- **The worker captures its realm's console** (`captureConsole` in `log.ts`). transformers.js and ORT print handled conditions through `console.warn`/`console.error`; they re-emit as debug `info`, first string argument only — later arguments carry model inputs, which are post text. A real library failure still throws and is judged by the caller.

## Definition of done

- [ ] Hard invariants hold; privacy and fail-open paths covered by assertions.
- [ ] `npm run compile && npm test` clean.
- [ ] Adapter changes tested against fixture HTML, never a live fetch.
- [ ] Verified in Chrome **and** Firefox when touching manifest, messaging, or the engine.
- [ ] Zero raw `console.*`; never log post text.
- [ ] No new comment except a true edge-case WHY; none over 2 lines.
- [ ] Measurements and dated findings in `wiki-llm/`, never inline.
- [ ] Owning wiki page updated in the same commit.
