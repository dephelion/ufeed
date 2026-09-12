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
  core/         protocol.ts · cache.ts · settings.ts (pure) · settings-storage.ts · log.ts · debug.ts
  adapters/     types.ts · x.ts · index.ts
  feed/         runs inside the host feed
                  policy.ts    the blur decision, pure
                  scanner.ts   finds posts, says when one nears the viewport
                  queue.ts     batches to the engine, discards stale replies
                  threshold.ts recent scores, absolute vs relative cut
                  tuning.ts    corrections and their persistence
                  language.ts  the model's language gate, pure
                  blur.ts · media.ts · language-detector.ts · score-badge.ts · feedback-bar.ts · engine-client.ts · blur.css
  entrypoints/  content.ts · engine/ · background.ts · popup/
public/ort/     ONNX runtime, synced by scripts/sync-ort.mjs
wiki-llm/       source of truth
specs/          design docs: one ACTIVE PLAN at most, the rest provenance
```

**`specs/` holds at most one active plan.** [v2-spec.md](../specs/v2-spec.md) is
the task plan for work in flight: read it to see what is being built and in what
order. It is never authority on current behaviour — each task updates its owning
wiki page in the same commit, and the plan is marked superseded once delivered.
Every other file in `specs/` is provenance.

`.local/` is gitignored and holds the measurement harnesses and the captured
timeline data they ran against. The harnesses are reproducible from
[model.md](model.md); the data is personal and never ships.

**Validate anything read back from `storage.local`.** It outlives the shape that wrote it. `normalizeFeedback()` drops what no longer parses instead of trusting it — a stale correction shape reached `.filter` and took the whole content script down before it could blur anything. Spreading defaults over stored JSON (`{ ...DEFAULTS, ...stored }`) checks nothing.

**`entrypoints/content.ts` wires, it does not decide.** Every piece of feed state has an owner: `scanner` what it has seen, `queue` what is in flight, `threshold` the recent scores, `tuning` the corrections. Logic that grows there belongs in `feed/`.

**The blur decision is pure.** `feed/policy.ts` answers reveal / peek / blur / blur-media / blur-language from settings, text, score, threshold and a detected language — no DOM, no element. The caller applies the answer. Fail-open and the tier boundaries are decided there, so they test in milliseconds instead of through happy-dom.

**`core/` and `ml/scoring.ts` import no browser API.** That split is why the logic that can be wrong tests in milliseconds. `settings.ts` was split from `settings-storage.ts` for exactly this — the polyfill throws on import outside an extension. `language.ts` is split from `language-detector.ts` on the same line, and for the same reason.

## Hard invariants

1. **Privacy.** Post text never leaves the device, never reaches a log, never persists at all. Zero analytics. Only model weights are fetched. **Amended in v2:** embeddings of posts the user explicitly corrected persist in `storage.local`. Vectors only, never text, never transmitted. See [privacy.md](privacy.md).
2. **Fail-open.** Every error, timeout and unready state reveals. No path may leave a post blurred because something broke.
3. **Host page integrity.** All injected CSS namespaced `.lx-*`. No layout side effects beyond the documented `position: relative`. Never mutate host DOM beyond class and `aria-hidden` toggles.
4. **Cross-browser floor.** Every API must work on Chrome MV3 **and** Firefox MV3. Promise-style polyfill only — never callbacks, never an aliased `browser ?? chrome`. Chrome-only paths are optimisations behind a fallback.
5. **Main thread.** No inference, embedding or tokenization on the page's main thread.

## Build modes

| Command                 | Output                | Logs | Readable source       |
| :---------------------- | :-------------------- | :--- | :-------------------- |
| `npm run watch`         | `.output/chrome-mv3`  | on   | yes, inline sourcemap |
| `npm run build:debug`   | `.output/chrome-mv3`  | on   | yes, inline sourcemap |
| `npm run build`         | `.output/chrome-mv3`  | off  | no, minified          |
| `npm run build:firefox` | `.output/firefox-mv3` | off  | no, minified          |

**`VITE_LENSING_DEBUG` turns off minification too**, in `wxt.config.ts`. `watch` builds production-shaped output on purpose — that is what keeps `new Worker()` same-origin — but minified output reports every failure as `content.js:1`, which is useless for a stack trace.

**The score badge is a setting, not a build flag.** It ships in every build behind `showScores`; only console logs are compiled out. See [ui.md](ui.md).

**`npm run dev` does not work for engine changes.** WXT serves entrypoint modules from `localhost`, which makes `new Worker()` cross-origin; it throws and the engine never starts, silently. Use `npm run watch`. `dev` is fine for popup-only work.

## Definition of done

- [ ] Hard invariants hold; privacy and fail-open paths covered by assertions.
- [ ] `npm run compile && npm test` clean.
- [ ] Adapter changes tested against fixture HTML, never a live fetch.
- [ ] Verified in Chrome **and** Firefox when touching manifest, messaging, or the engine.
- [ ] Zero raw `console.*`; never log post text.
- [ ] No new comment except a true edge-case WHY; none over 2 lines.
- [ ] Measurements and dated findings in `wiki-llm/`, never inline.
- [ ] Owning wiki page updated in the same commit.
