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

## Invalidation

| Change            | Effect                                                                     |
| :---------------- | :------------------------------------------------------------------------- |
| Strictness / band | Re-apply threshold from cache. No inference.                               |
| Topics            | `epoch += 1`, clear cache and queue, new `seen` set, reveal all, re-sweep. |
| Host disabled     | Reveal all, stop.                                                          |

**Epoch guards the race.** A batch in flight when topics change returns scores measured against the old vectors; replies from a previous epoch are discarded.

## Failure posture

Fail-open everywhere. Unknown score, request timeout (8s), engine `ERROR`, or worker crash all **reveal**. A 15s watchdog logs if the engine never reports in. No path may leave a post blurred because something broke.
