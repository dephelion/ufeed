# Lensing
## On-Device Semantic Focus Extension — Technical Specification

---

## 1. Vision

**Lensing** is a privacy-first, zero-backend browser extension. The user picks
one or more topics; Lensing softens everything else in their social feeds in real
time, using a model that runs entirely on their device.

### Principles

* **Zero backend.** No server, no inference cost, no account. The only network
  request is a one-time model download from a CDN.
* **No data leaves the device.** Post text is embedded locally and discarded.
* **No account side effects.** Pure local DOM and CSS transformation — no
  blocking, muting, unfollowing, or platform API calls.
* **Fail-open.** A slow or broken model must never leave the user staring at a
  blurred wall. Degradation means *less filtering*, never *less usable*.

---

## 2. Core Paradigm: Positive Isolation

| | Negative Filtering | Positive Isolation (Lensing) |
| :--- | :--- | :--- |
| **Goal** | Remove specific bad topics. | Reveal only the chosen topics; soften the rest. |
| **Logic** | Enumerate 1,000+ bad categories. | Score similarity to N user topics. |
| **Failure mode** | Missed post = distraction. | Missed post = softened, still peekable. |
| **UX action** | Hard delete (`display: none`). | Soft blur + hover/tap-to-peek. |
| **Use case** | Cleaning a feed. | Turning "For You" into a topic-specific feed. |

The asymmetry in failure modes is the whole argument. Under negative filtering,
every category you forget to enumerate costs you. Under positive isolation, a
miss costs the user a blur they can peek through.

---

## 3. Architecture

### 3.1 Where inference runs

Four platform constraints determine this, and together they leave one portable
answer:

* `Worker` is not exposed in `ServiceWorkerGlobalScope` — an MV3 service worker
  cannot spawn a nested worker.
* `navigator.gpu` is not available in a service worker.
* MV3 service workers are terminated after roughly 30s idle, which would evict a
  multi-megabyte model repeatedly.
* A content script cannot `new Worker(runtime.getURL(...))` — the worker script
  is cross-origin to the host page and subject to the host page's CSP.

Inference therefore runs in an **extension-origin document**. The content script
injects a hidden iframe pointing at a `web_accessible_resources` page. That page
carries our own CSP, has a full DOM, can reach `navigator.gpu`, and can spawn a
module Worker.

```
┌─────────────────────────── Host page (x.com / reddit.com) ────────────────────┐
│                                                                               │
│  content script                                                               │
│    ├─ per-site adapter: find post nodes (incl. shadow roots)                   │
│    ├─ IntersectionObserver: only score what's near the viewport                │
│    ├─ verdict cache: hash(text) → score                                        │
│    └─ applies/removes .lx-blur                                                 │
│                                                                               │
│  <iframe hidden src="chrome-extension://…/engine.html">  ← extension origin    │
│                          │ MessageChannel port                                 │
└──────────────────────────┼────────────────────────────────────────────────────┘
                           ▼
            ┌──────────────────────────────────────────┐
            │ engine.html  (extension page)            │
            │   └─ new Worker('engine-worker.js')      │
            │        • Transformers.js v3              │
            │        • WebGPU, WASM fallback           │
            │        • all-MiniLM-L6-v2 (~23MB int8)   │
            │        • embed(post) → cosine vs topics  │
            └──────────────────────────────────────────┘

Background service worker: settings broadcast and download progress only.
No inference. Never on the hot path.
```

**Chrome optimisation (post-v1).** `chrome.offscreen` gives a single
browser-wide engine instead of one per tab, saving roughly 60–100MB per
additional tab. Firefox and Safari have no offscreen API, so the iframe path
stays the default and stays the one that is tested. Adopt offscreen only if §12.6
shows multi-tab memory is a real problem.

**Memory guard.** The engine unloads its model after N minutes of tab
invisibility (`document.visibilityState`) and re-warms on return.

### 3.2 Stack

| Layer | Choice | Notes |
| :--- | :--- | :--- |
| Build | **WXT** | Generates per-browser manifests. Load-bearing — see §5. |
| Browser API | `webextension-polyfill`, promise-only | Never mix callback and promise styles. |
| Runtime | Transformers.js v3 (`@huggingface/transformers`) | ONNX Runtime Web. |
| Backend | WebGPU, falling back to WASM (SIMD, **single-threaded**) | Threads unavailable — see §12.1. Detect at init, surface in the UI. |
| Model | `Xenova/all-MiniLM-L6-v2`, int8 quantized (~23MB) | Confirm the ONNX artifact and benchmark before locking in (§12.2). |
| WASM binaries | Bundled locally, `env.backends.onnx.wasm.wasmPaths` pointed at them | CDN-fetched WASM reads as remote code to store reviewers. |

---

## 4. Classification

### 4.1 Embeddings and a threshold

```
topicVecs = topics.map(embed)          // computed once, cached in storage
postVec   = embed(post.text)           // one forward pass per post
score     = max(cosine(postVec, t) for t in topicVecs)
keep      = score >= strictness
```

Three properties matter:

* **Multi-topic is free** — it is a `max` over precomputed vectors, so cost is
  independent of how many topics the user adds.
* **One forward pass per post.**
* **`strictness` is a user-facing slider**, not a hidden constant.

Topic vectors are recomputed only when the user edits their topic list.

An alternative worth naming and rejecting: zero-shot NLI classification costs one
forward pass *per label per text*, scales linearly in topic count, and produces
scores normalized over the candidate set — so a verdict shifts when you reword an
unrelated label. It does not fit a multi-topic product on a latency budget.

### 4.2 Throughput controls, cheapest first

1. **Verdict cache.** `hash(normalizedText) → score`, in-memory per tab plus an
   LRU in `storage.local`. Feeds re-render the same posts constantly; this is the
   single largest win.
2. **Viewport gating.** An `IntersectionObserver` with a generous `rootMargin`
   (~1.5 viewports) queues work. Items scrolled well past are dropped from the
   queue rather than scored.
3. **Batching.** Up to 16 texts per message, flushed on a 100ms debounce or when
   full. Text truncated to ~256 tokens.
4. **Keyword prefilter** (v1.1). Exact matches drawn from the user's topics
   resolve obvious keeps with no forward pass. Required before Android is viable.

### 4.3 User controls

* Topic list — free text, multiple entries.
* Strictness slider, mapped to the cosine threshold, with a "preview on this
  page" affordance. **The slider maps to 0.02–0.30, not 0–1.** Measured scores
  cluster low — on-topic mean 0.19, off-topic 0.06, nothing above 0.42 (§12.2).
  A linear 0–1 control would leave most of its travel dead.

**Topic entry guidance.** Measured in §12.2; surface as a tooltip on the topic
field, because users get all three of these wrong by default:

* *Name the subject in a few words.* Short noun lists (`tech, software, ai`)
  outperform sentences describing what you want.
* *Do not write a description.* A verbose phrasing scored 12 AUC points worse
  than a three-word list. Multi-anchor averaging also lost.
* *Topics match subject, not quality.* A shallow take and a deep technical post
  on the same subject both match. Lensing cannot separate slop from substance.
  This is a hard limit of the approach, not a tuning problem — say so in the UI.
* Per-site enable/disable, and a global one-click off in the toolbar.
* Always-keep and always-blur keyword overrides. Cheap to build, and
  disproportionately reassuring as an escape hatch when the model is wrong.

---

## 5. Manifest & Permissions

WXT generates one manifest per browser:

* **Chrome/Edge** — `background.service_worker`, `type: "module"`.
* **Firefox** — `background.scripts` (non-persistent event page), plus a required
  `browser_specific_settings.gecko.id`.
* **Safari** — MV3 via `safari-web-extension-converter`.

Shared configuration:

```jsonc
{
  "permissions": ["storage", "scripting"],
  "host_permissions": ["*://x.com/*", "*://twitter.com/*"],
  "optional_host_permissions": ["*://*.reddit.com/*", "*://reddit.com/*"],
  "content_scripts": [{
    "matches": ["*://x.com/*", "*://twitter.com/*"],
    "js": ["content.js"],
    "css": ["blur.css"],
    "run_at": "document_start"
  }],
  "web_accessible_resources": [{
    "resources": ["engine.html", "engine-worker.js", "onnx/*.wasm"],
    "matches": ["*://x.com/*", "*://twitter.com/*", "*://*.reddit.com/*"]
  }],
  "content_security_policy": {
    "extension_pages": "script-src 'self' 'wasm-unsafe-eval'; object-src 'self'"
  },
  "action": { "default_popup": "popup.html" },
  "options_ui": { "page": "options.html" }
}
```

Details that are easy to get wrong:

* `'wasm-unsafe-eval'` is mandatory or ONNX Runtime will not instantiate.
* `*://*.reddit.com/*` does **not** match bare `reddit.com` — both patterns are
  needed.
* Blur CSS ships via `content_scripts[].css`, not injected from JS. Declared CSS
  applies before first paint; injected CSS does not, and the gap is a visible
  flash of unfiltered content.
* `run_at: "document_start"` for the same reason.
* Install-time hosts stay minimal. Everything else is requested through
  `optional_host_permissions` when the user asks for that site. This is both the
  store-friendly path and the honest one.

---

## 6. UX & Rendering

### 6.1 Fail-open

**Nothing is blurred until the engine is ready.** On first run the user sees a
normal feed and a download-progress badge. Filtering begins when the model is
warm. Per item, a score that has not arrived within ~800ms reveals the item
rather than holding the blur.

This trades a brief flash of off-topic content for the guarantee that a failed
download, a WebGPU init error, or a cold cache can never produce an
unexplained, unusable page.

Engine state is always visible in the toolbar icon: `downloading` / `warming` /
`active (webgpu)` / `active (wasm)` / `error`.

### 6.2 The blur

`filter: blur()` on a feed item is the wrong primitive. It creates a stacking
context **and a containing block**, which breaks `position: fixed` descendants
and disrupts platform overlays and scroll machinery. Applied to hundreds of large
elements it is also expensive enough to jank mid-scroll.

Blur the *text subtree* instead:

```css
.lx-blur { opacity: .45; transition: opacity .2s ease; }
.lx-blur :is(p, span, h1, h2, h3, a) {
  color: transparent !important;
  text-shadow: 0 0 10px currentColor;
}
.lx-blur img, .lx-blur video { opacity: .25; }
```

Cheap, composited, no layout side effects.

Two rules alongside it:

* **Toggle `aria-hidden` with the class.** Blurred content is otherwise fully
  present in the accessibility tree, which defeats the purpose for screen reader
  users.
* **Never nest.** Blur the outermost post container and mark descendants as
  claimed, so effects cannot stack.

### 6.3 Peek & reveal

Three tiers, escalating with intent:

* **Hover (desktop):** transient peek. Reverts on mouse-out.
* **Click / tap:** reveals the post and it stays revealed. The click is consumed
  and does *not* reach the post underneath, so it never navigates.
* **Second click / tap:** normal interaction. Links, media, and the post itself
  behave exactly as the platform intends.

Both use the §6.2 transition — the reveal is eased, not instant.

Implementation notes:

* `pointer-events: none` on the blurred subtree is what makes the first click
  consumable. Without it the first tap navigates before any reveal registers, and
  `:active` alone is unreliable on iOS Safari.
* **A node-level flag is sufficient.** If virtualized scrolling recycles the node
  and the reveal is lost, the post simply re-blurs on its score. That is an
  accepted tradeoff, not a bug — do not add a persistence layer for it.
* A reveal overrides the score for that post only. It does not adjust the
  strictness threshold, and it is not a keyword override (§4.3).

---

## 7. Site Adapters

Selectors are per-site and versioned. These DOMs change without notice, and an
adapter that silently stops matching must be detectable — each adapter reports a
match count, and zero matches on a feed page raises a diagnostic.

### X

* Post container is `[data-testid="cellInnerDiv"]`. Using `article` leaves the
  surrounding padding and separators unblurred.
* Text is `[data-testid="tweetText"]`.
* **The feed is virtualized** — nodes are recycled with new content. A
  `data-checked` flag on the node produces stale reveals as a recycled node keeps
  the previous verdict. Key the cache on a hash of the text and re-evaluate on
  mutation.

### Reddit

New Reddit renders `shreddit-post` as web components. `querySelectorAll` does not
pierce shadow roots, and a `<style>` in `document.head` does not apply inside
them. The adapter needs recursive shadow-root traversal plus per-root style
injection via `adoptedStyleSheets`.

### Observer requirements

* Check `node.matches(sel)` **as well as** `node.querySelectorAll(sel)` — an
  added node that *is* a post is otherwise missed entirely.
* Run a full scan at startup. A mutation-only observer never sees the first
  screenful.
* Observe `characterData` and subtree changes to catch recycled nodes.
* Never use generic selectors such as bare `p`. They match navigation, sidebars,
  our own UI, and text nested inside already-claimed posts.

---

## 8. Messaging Contract

Every request carries an id. Replies are correlated explicitly — never by
index-order coincidence, which breaks as soon as two batches are in flight.

```ts
// content → engine (MessageChannel port on the iframe)
{ id: string, type: 'SCORE', texts: string[] }
{ id: string, type: 'SET_TOPICS', topics: string[] }

// engine → content
{ id: string, type: 'SCORES', scores: number[] }   // raw cosine, not booleans
{ type: 'STATUS', state: 'downloading'|'warming'|'ready'|'error',
  backend?: 'webgpu'|'wasm', progress?: number, message?: string }
```

The engine returns **raw scores**, not booleans. Moving the strictness slider
then re-applies instantly across every cached verdict with no inference at all.

API style: `webextension-polyfill` with `await` throughout. Firefox's `browser.*`
namespace is promise-only and silently ignores a trailing callback, so
callback-style calls on an aliased namespace fail with no error. Any
`runtime.onMessage` handler doing async work must return a promise (or `return
true` under raw `chrome.*`) or the reply channel closes before the response.

---

## 9. Platform Scope

**v1 targets desktop.** The architecture stays portable and the WASM fallback
stays first-class, but shipping is not blocked on mobile.

| Platform | Status | Notes |
| :--- | :--- | :--- |
| Chrome / Edge / Brave | **v1** | WebGPU available. Primary development target. |
| Firefox desktop | **v1** | WebGPU confirmed working (macOS, §12.1). Rollout is uneven across OSes, so the WASM fallback stays required. |
| Firefox Android | **v1.1, gated on benchmarks** | No practical WebGPU today, so WASM only. Needs the keyword prefilter and hard viewport gating before shipping it is honest. |
| Safari / iOS | **Spike only** | `safari-web-extension-converter` produces a wrapper, but iOS extension memory limits are tight for a model plus ORT runtime, there is no offscreen API, and WebGPU in an iOS extension context is unproven. |
| Chrome Android | **Not possible** | No extension support. |
| Edge Android, Kiwi | **Not viable** | Edge Android allows only a fixed curated list; Kiwi is discontinued. |

Firefox is the only realistic Android target.

---

## 10. Performance Budget

Acceptance criteria, not aspirations.

| Metric | Budget |
| :--- | :--- |
| Cold start (model cached) to first verdict | < 1.5s |
| Per-post latency, steady state, WebGPU | < 40ms |
| Per-post latency, steady state, WASM desktop | < 400ms (single-threaded) |
| Cache hit rate over a 5-minute X scroll | > 60% |
| Main-thread blocking per frame | < 4ms (all inference off-thread) |
| Resident memory, engine warm | < 150MB per instance |

**No WASM threads.** An iframe injected into a host page cannot be cross-origin
isolated, so `SharedArrayBuffer` is unusable and ORT runs WASM single-threaded
(§12.1). The fallback budget above reflects that. WebGPU is the fast path on both
desktop browsers; WASM is for machines and builds that lack it.

**Model caching.** Transformers.js caches weights through the **Cache API**, which
browsers evict under storage pressure — Safari aggressively. Assume re-download
will happen: show progress, and stay fail-open when offline.

---

## 11. Privacy, Store & Legal

* **Data.** Post text is read, embedded, and discarded in-process. Nothing is
  transmitted.
* **No analytics in v1.** A hard constraint, and what makes Chrome's "does not
  collect user data" declaration truthful.
* **Network.** Exactly one class of request: model weights from the CDN on first
  run. Document it in the store listing and privacy policy.
* **Privacy policy URL** is required for Chrome Web Store submission.
* **AMO requires unminified source plus reproducible build instructions.** With a
  WXT build and bundled ONNX/WASM binaries, prepare for this from the start — it
  is a common late surprise.
* **Bundle the ORT `.wasm` files.** CDN-fetched WASM is reviewed as remote code
  execution and is a rejection risk.
* **No platform trademarks in the extension title.**
* **Single purpose:** topic-based content blurring, nothing else.

**Legal posture.** Client-side DOM modification by user-installed extensions is
widespread and generally tolerated. The relevant exposure is **platform terms of
service**, not copyright: X's terms restrict automated access to and modification
of the service, and extensions that alter X have drawn enforcement attention.
Treat this as a product risk to monitor, not a settled question, and get counsel
before any commercial launch.

---

## 12. Spikes

Run these before feature work. Each can invalidate part of the design.

1. ~~**Engine iframe.**~~ **RESOLVED 2026-09-11 — architecture confirmed.**
   Chrome and Firefox both reach `requestDevice()` from a Worker inside a
   `chrome-extension://` iframe injected into x.com. Harness: `spikes/webgpu-iframe/`.
   Set `allow="webgpu"` on the injected iframe — cheap insurance, kept.
   Measured on one Apple Silicon Mac: proves the architecture, not install-base
   coverage. Firefox Android still has no WebGPU, so fail-open and the WASM
   fallback stay load-bearing.

   Also settled: **`crossOriginIsolated` is false in the injected iframe on both
   browsers**, because the host page does not send COEP. No usable
   `SharedArrayBuffer`, therefore **no WASM threads** — see §10.
2. ~~**Model viability.**~~ **RESOLVED 2026-09-11 — premise holds.**
   205 labelled posts from a real timeline, 26 on topic (13% base rate),
   `all-MiniLM-L6-v2` q8, ~4ms/post on CPU. **AUC 0.826.** At threshold 0.18 the
   feed goes from 205 posts at 13% signal to 27 posts at 52% signal.
   Harness, data and full results in `spikes/topic-viability/`.

   Tested and rejected in the same run: **rephrasing the topic string is not a
   lever.** Six phrasings; the shortest noun list won, descriptive sentences lost
   up to 12 AUC points, multi-anchor averaging lost. 0.826 is roughly the ceiling
   for this model on this feed — further gains need a bigger model, not better
   wording. Known weakness: systems posts scoring near zero
   (`"Can a small ZIP file crash my server?"` at -0.019).
3. ~~**Threshold calibration.**~~ **RESOLVED — default strictness 0.18.**
   Lean precision over recall, contrary to the usual instinct: because §6.2 blurs
   rather than deletes, a miss is dimmed and one click away, while a false
   positive costs real attention. Best-F1 also lands at 0.18.
4. **Reddit shadow DOM.** Prove traversal plus `adoptedStyleSheets` works on live
   new Reddit.
5. **X recycling.** Confirm the text-hash cache survives virtualized scrolling
   with no stale reveals.
6. **Multi-tab memory.** Five open feed tabs; measure. Decides whether the Chrome
   offscreen path is v1 or v1.1.

---

## 13. Milestones

1. **Spikes** — §12.1 and §12.2 kill or confirm the architecture.
2. **Skeleton** — WXT project, per-browser manifests, engine iframe handshake,
   status reporting. No model yet.
3. **Engine** — model load, embedding, cosine scoring, backend detection,
   download progress.
4. **X adapter** — viewport gating, verdict cache, blurring, peek. Single topic.
5. **UI** — popup with topics, strictness, per-site toggle, engine status.
6. **Multi-topic and keyword overrides.**
7. **Reddit adapter** — shadow DOM traversal.
8. **Performance pass** against §10. Chrome offscreen if §12.6 demands it.
9. **Store preparation** — privacy policy, AMO source bundle, permission
   justifications.
