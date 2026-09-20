# Conventions

> **Maintenance Invariant:** Every repo rule, stated once: hard invariants, how to work, code and doc rules, layout, toolchain, definition of done. `AGENTS.md` points here and repeats none of it. Update in the SAME commit as any rule, layout or toolchain change. Token-optimized: imperative, no prose, no redundancy.
> **Answers:** Hard invariants, the Dependency Rule among them. How to work in this repo. Code, comment and doc rules. Repo layout. Toolchain. Build modes. Logging. Definition of done.

## Hard invariants

1. **Privacy.** Post text never leaves the device, never reaches a log, never persists. Zero analytics. The only network request is the model weights from the CDN. Embeddings of posts the reader explicitly rated persist in `storage.local` — vectors only, never text, never transmitted. See [privacy.md](privacy.md).
2. **Fail-open.** Every error, timeout and unready state reveals. No path may leave a post blurred because something broke; assert it directly. A backend that loads but miscomputes is rejected, not trusted ([model.md](model.md)).
3. **Host page integrity.** All injected CSS namespaced `.lx-*`. No layout side effects beyond the documented `position: relative`. Never mutate a host element beyond class and `aria-hidden` toggles and namespaced `data-lx-*` attributes. Our own nodes (engine iframe, thumbs bar, no-topics card, posts-hidden badge, `.lx-sr` announcer) carry `.lx-*` and are never inserted into a post.
4. **Cross-browser floor.** Every API must work on Chrome MV3 **and** Firefox MV3. Promise-style polyfill only — never callbacks, never an aliased `browser ?? chrome`. Chrome-only paths are optimisations behind a fallback. Sole callback exception: `action.setIcon` in `background.ts` — Chrome logs a stale-tab error as unchecked `runtime.lastError` despite a caught promise.
5. **Main thread.** No inference, embedding or tokenization on the page's main thread.
6. **The Dependency Rule.** Source code dependencies point inward only: `entrypoints/` → `adapters/` · `platform/` → `feed/` → `core/`. Nothing in an inner ring names anything in an outer one. Rings, ports and where new code goes: [layers.md](layers.md). `src/architecture.test.ts` enforces it.

## Working

- **Wiki first.** Read [index.md](index.md) before any code, architecture, model, selector, UI, permission or testing task; open only the page it names.
- **Branch, never `main`.** Every change lands on a branch and reaches `main` through a PR with CI green. A release bumps the minor version (`npm version minor --no-git-tag-version`); store zips are built from `main` ([development.md](../docs/development.md) §Release).
- **Explain plainly.** A human reads every explanation, summary, PR body and review. Point first, short sentences, define a term the first time it appears.
- **Confirm costs the owner has not weighed** — model size, dependency weight, new permissions. Never ask before a `wiki-llm/` edit.
- **Cheap validation first.** Prove the cheap version before proposing the expensive one, and quantify the expensive path.
- **Root causes over patches.** No `as any`, no local hack around a contract.
- **Work in-thread.** Delegate only mechanical edits that need no repo-wide context.

## Code

**Comments default to none.** Write one only for a WHY the code cannot express: a browser bug, a vendor DOM quirk, deliberately counterintuitive logic. Never narrate an edit or restate a name. **Two lines maximum**; a longer WHY is a wiki page, cited (`see adapters.md §X`). Delete adjacent comments an edit makes obsolete.

**Validate anything read back from `storage.local`.** It outlives the shape that wrote it. `normalizeFeedback()` drops what no longer parses instead of trusting it — a stale correction shape reached `.filter` and took the whole content script down before it could blur anything. Spreading defaults over stored JSON (`{ ...DEFAULTS, ...stored }`) checks nothing; `withDefaults()` keeps a field only when its type matches the default's, which also covers a hand-edited backup.

**`entrypoints/content.ts` wires, it does not decide.** Every piece of feed state has an owner: `filter` the decisions and what the engine last received, `scanner` what it has seen, `queue` what is in flight, `tuning` the ratings. Logic that grows in `content.ts` belongs in `feed/`.

**The blur decision is pure.** `core/policy.ts` answers reveal / peek / blur / blur-media / blur-language from settings, text, score, threshold, a detected language and a near-identical rating — no DOM, no element. The caller applies the answer. Fail-open and the tier boundaries are decided there, so they test in milliseconds instead of through happy-dom.

**Nothing the worker imports touches the polyfill.** The polyfill throws outside an extension page, and the worker is not one; `architecture.test.ts` walks the worker's imports to prove it. `platform/` tests fake the browser through `vitest.setup.ts` (WXT's `fakeBrowser`); a test file's own `vi.mock` still wins.

## Docs

- **`wiki-llm/` is the source of truth.** Decisions, invariants, architecture, measurements: what makes an agent faster or cheaper at implementing. Update the owning page in the SAME commit as any change to architecture, message contract, selectors, model, thresholds, permissions, budgets or build commands. New page -> add its [index.md](index.md) row; no orphans.
- **Wiki pages are written to the token-optimized standard.** Telegraphic, imperative, one fact per line, no rule repeated across sections. Keep each page's `Maintenance Invariant` and `Answers` lines.
- **Measurements live in the wiki**, with the method beside the number. A constant in code cites its page and nothing more.
- **`docs/` is for people**: runbooks, device setup, click-through steps, plain-language explanations. Never agent material. What each human doc and the README may hold is in [product.md](product.md) §Where copy lives.
- **`.local/` is gitignored**: measurement harnesses and the captured timeline data they ran against. The data is personal and never ships; never cite `.local/` as authority. Conclusions graduate to the wiki.

## Layout

`src/` is five folders, one per ring of the Dependency Rule — which file goes where, and why: [layers.md](layers.md).

```
src/            core/ · feed/ · adapters/ · platform/ · entrypoints/ · architecture.test.ts
public/ort/     ONNX runtime, synced by scripts/sync-ort.mjs
wiki-llm/       source of truth
docs/           for people
```

## Toolchain

| Concern     | Choice                                                        |
| :---------- | :------------------------------------------------------------ |
| Runtime     | Node 22.12+ (`engines`; vite needs it), CI on 22              |
| Language    | TypeScript, `strict`, `noUncheckedIndexedAccess`, ESM         |
| Framework   | **WXT** — generates both manifests, owns entrypoint discovery |
| Tests       | **Vitest**, `happy-dom` for DOM tiers                         |
| Browser API | `webextension-polyfill`, **promise style only**               |
| Inference   | `@huggingface/transformers` v3 over ONNX Runtime Web          |

## Build modes

| Command                 | Output                                                  | Logs | Readable source       |
| :---------------------- | :------------------------------------------------------ | :--- | :-------------------- |
| `npm run watch`         | `.output/chrome-mv3-debug`, `.output/firefox-mv3-debug` | on   | yes, inline sourcemap |
| `npm run build:debug`   | `.output/chrome-mv3-debug`                              | on   | yes, inline sourcemap |
| `npm run build`         | `.output/chrome-mv3`                                    | off  | no, minified          |
| `npm run build:firefox` | `.output/firefox-mv3`                                   | off  | no, minified          |

**Debug is the WXT mode, never an env var.** `--mode debug` (`npm run watch`, `npm run build:debug`) turns on logs and turns off minification; nothing else logs, `npm run dev` included; `core/debug.ts` and `wxt.config.ts` read the mode and nothing else. WXT loads `.env` into `process.env` and Vite reads `NODE_ENV`, so an env-based flag let a stray `.env` ship logs in a store build. Debug output lands in `*-debug/`, never the production folder that `npm run zip` packs. `watch` builds production-shaped output on purpose — that is what keeps `new Worker()` same-origin — but minified output reports every failure as `content.js:1`, which is useless for a stack trace.

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

- [ ] `npm run check` clean: format, typecheck, tests (the Dependency Rule included), both builds. CI runs the same script.
- [ ] New code sits in the ring [layers.md](layers.md) names; a new folder or port updated that page.
- [ ] Hard invariants hold; privacy and fail-open paths covered by assertions ([testing.md](testing.md)).
- [ ] Adapter changes tested against fixture HTML, never a live fetch.
- [ ] Verified in Chrome **and** Firefox when touching manifest, messaging, or the engine.
- [ ] Zero raw `console.*`; never log post text.
- [ ] No new comment except a true edge-case WHY; none over 2 lines.
- [ ] Owning wiki page updated in the same commit.
