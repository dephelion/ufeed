# Architecture

> **Maintenance Invariant:** Structure, layers, message flow only. No selectors ([adapters.md](adapters.md)), no scoring rules ([model.md](model.md)). Update in the SAME commit as any boundary or contract change. Token-optimized: imperative, no prose, no redundancy.
> **Answers:** The three layers and why each exists. End-to-end flow. Message contract. Invalidation and races.

## Three layers

| Layer          | Lives in                                 | Can                               | Cannot                    |
| :------------- | :--------------------------------------- | :-------------------------------- | :------------------------ |
| Content script | Host page world (`x.com`)                | Read feed DOM, apply blur         | Spawn an extension worker |
| Engine iframe  | Extension origin (`chrome-extension://`) | Spawn a same-origin module Worker | See the host DOM          |
| Worker         | Separate thread, extension origin        | Load the model, embed, score      | Touch any DOM             |

**Why the iframe exists.** Four constraints leave one portable answer:

- `Worker` is not exposed in `ServiceWorkerGlobalScope` — an MV3 service worker cannot spawn one.
- `navigator.gpu` is unavailable in a service worker.
- MV3 service workers terminate after ~30s idle, evicting the model repeatedly.
- A content script cannot `new Worker(runtime.getURL(...))` — cross-origin to the host page, and subject to the host page's CSP.

A document already on the extension origin can spawn the worker. The iframe is that document. It routes messages and owns status; it does no work.

**The iframe never sees the host DOM.** Strings in, floats out. That is what keeps the ML layer site-agnostic.

## Flow

```
feed DOM ──adapter──► content script ──MessageChannel──► iframe ──postMessage──► worker
    ▲                       │                                                      │
    └──── .lx-blur ─────────┴──────────────── scores ◄─────────────────────────────┘
```

1. `MutationObserver` on `document.documentElement` → `sweep(node)`.
2. Adapter returns posts; unseen ones go to an `IntersectionObserver` (`rootMargin: 150% 0px`).
3. On intersection: cache hit or override decides immediately; otherwise queue.
4. Queue flushes at 16 posts or a 100ms debounce.
5. Worker embeds, scores against topic vectors, replies with **raw scores**.
6. `decide()` blurs or reveals; the score is cached by text hash.

Background service worker: nothing on the hot path. Settings propagate through `storage.onChanged`.

## Persisted state

Two `storage.local` keys, and no others: `settings`, and `feedback` as `{ model, dim, byTopic }`.

**Both are a file format now**, readable and writable through the popup's backup row — `src/core/config-transfer.ts` owns it, pure, with the base64 float32 vector encoding. Adding a third key means deciding whether it belongs in a backup.

**The model stamp is the gate.** A missing one reads as `Xenova/e5-small-v2`, which is what every install that predates the stamp holds. On any other id or width, `forCurrentModel()` drops the vectors at load and keeps the settings: another model's embeddings are in another coordinate space, and the post text they came from was discarded at rating time, so there is nothing to re-embed. Shipping a new model therefore costs every reader their corrections — weigh it in the release, and say so in the popup.

**Feedback propagates through `storage.onChanged` like settings do.** `onFeedbackChanged` -> `Tuning`. Without it a feed tab keeps the corrections it loaded at startup and the next thumb writes that copy back over a clear or an import.

## Message contract

`src/core/protocol.ts` owns the types and the guards. Both sides validate; a host page posts its own messages constantly.

```
content → engine   { id, type: 'SCORE',      texts }
content → engine   { id, type: 'SET_TOPICS', topics }
content → engine   { id, type: 'FEEDBACK',   text, liked }
                   SET_TOPICS also carries liked/disliked vectors
engine  → content  { id, type: 'SCORES',     scores }   raw cosine, never booleans
engine  → content  { id, type: 'VECTOR',     vector }   the correction, to persist
engine  → content  { id, type: 'ACK' }                  no pending entry by design
engine  → content  { id, type: 'ERROR',      message }
engine  → content  { type: 'STATUS', state, backend?, progress?, message? }
```

**The worker embeds a correction, the content script stores it.** Vectors live where the model lives; persistence lives where `storage.local` is reachable. The content script never embeds and the worker never persists.

**Raw scores, never booleans.** Moving the strictness slider re-applies the threshold over the cache with zero inference.

**Every request carries an id.** Index-order correlation breaks the moment two batches are in flight.

**Handshake:** iframe `load` → content script transfers a `MessagePort` → engine replies with its last status. Requests issued before the port opens are **buffered and drained**, not dropped; `#port?.postMessage` silently discarded the first `SET_TOPICS` and the model never loaded.

## Status channel

A second, separate contract: content script <-> popup, over `browser.runtime` messaging. `src/core/status-channel.ts`.

```
popup   → content  { type: 'lensing:status?' }            to the ACTIVE tab only
content → popup    EngineStatus (the reply)
content → popup    { type: 'lensing:status', status }     pushed on change
```

**Asked per tab, never stored.** Each feed tab runs its own engine. A shared `storage.local` value showed whichever tab wrote last, went stale the moment the reader switched tabs, and left a durable record of when a feed was last open — see [privacy.md](privacy.md). The popup asks the active tab at open and holds the answer in memory.

**Pushes are filtered by `sender.tab.id`.** Every feed tab broadcasts; without the check a background tab's download overwrites the foreground tab's reading.

**No reply means no engine on that tab.** `tabs.sendMessage` rejecting is the answer, not an error: not a feed, or not yet injected. Distinct from state `idle`, which means injected but not started.

**Costs no permission.** The active tab's id needs none; reaching its content script is covered by `host_permissions`.

**Reported changes are throttled** — new state, or progress moved >= 5 points. Per-file download progress fires several times a second.

## Invalidation

| Change        | Effect                                                                     |
| :------------ | :------------------------------------------------------------------------- |
| Strictness    | Re-apply threshold from cache. No inference.                               |
| Topics        | `epoch += 1`, clear cache and queue, new `seen` set, reveal all, re-sweep. |
| Host disabled | Reveal all, stop.                                                          |
| Turned on     | Same as Topics: the engine has never been sent a query.                    |

**Epoch guards the race.** A batch in flight when topics change returns scores measured against the old vectors; replies from a previous epoch are discarded.

## Failure posture

Fail-open everywhere. Unknown score, request timeout (8s), engine `ERROR`, or worker crash all **reveal**. A 15s watchdog logs (debug builds) if the engine never reports in. The worker keeps the last `SET_TOPICS` past a failed load and embeds it on the next request; a `SCORE` with no topics replies `ERROR`, never a score against nothing. No path may leave a post blurred because something broke.
