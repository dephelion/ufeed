# Architecture

> **Maintenance Invariant:** Runtime structure, execution contexts, message flow only. Code layers live in [layers.md](layers.md). No selectors ([adapters.md](adapters.md)), no scoring rules ([model.md](model.md)). Update in the SAME commit as any boundary or contract change. Token-optimized: imperative, no prose, no redundancy.
> **Answers:** The three execution contexts and why each exists. End-to-end flow. Message contract. Invalidation and races.

## Three execution contexts

Where code runs, not how it is layered: that is [layers.md](layers.md).

| Context        | Lives in                                 | Can                               | Cannot                    |
| :------------- | :--------------------------------------- | :-------------------------------- | :------------------------ |
| Content script | Host page world (`x.com`)                | Read feed DOM, apply blur         | Spawn an extension worker |
| Engine iframe  | Extension origin (`chrome-extension://`) | Spawn a same-origin module Worker | See the host DOM          |
| Worker         | Separate thread, extension origin        | Load the model, embed, score      | Touch any DOM             |

**Why the iframe exists.** Three constraints leave one portable answer:

- `Worker` is not exposed in `ServiceWorkerGlobalScope` — an MV3 service worker cannot spawn one.
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
2. Adapter returns posts; unseen ones go to an `IntersectionObserver` (`rootMargin: 150% 0px`). An offered post whose photo or first text mounts later is offered again: X can mount a cell before either. Other inner mutations never re-offer.
3. On intersection: a cache hit, a kept conversation, or the media or language rule decides immediately; otherwise queue.
4. Queue flushes when the model's batch is full or after a 100ms debounce. The batch is the posts nearest the viewport, ties in arrival order; a post whose node the page has removed is dropped, not scored. A batch stays committed for seconds on the slow model, so while the page is scrolling it waits for the scroll to settle, bounded so a scroll that never stops cannot starve the engine. `FeedFilter` reports every scroll, in any container.
5. Worker embeds, scores against topic vectors, replies with **raw scores**.
6. `decide()` blurs or reveals; the score is cached by text hash.

Steps 1–6 live in `FeedFilter` (`src/feed/filter.ts`). `content.ts` only wires it to storage, the engine client, the popup and the page.

Background service worker: nothing on the hot path. Settings propagate through `storage.onChanged`.

## Persisted state

Two `storage.local` keys, and no others: `settings`, and `feedback` as `{ model, dim, byTopic }`.

**Both are a file format now**, readable and writable through the popup's backup row — `src/core/config-transfer.ts` owns it, pure, with the base64 float32 vector encoding. Adding a third key means deciding whether it belongs in a backup.

**The model stamp is the gate, and ratings are filed under it.** `feedback` is a map keyed by model id, one entry per model that has any. A model reads only its own (`feedbackFor()`); a stamp or width that disagrees reads as none rather than being trusted. A pre-0.8 flat blob is read as `Xenova/e5-small-v2`'s, which is what every install that predates the map holds.

**A model switch destroys nothing.** Each model keeps its own ratings and a switch back restores them; writing one model's never touches another's (read-modify-write in `saveFeedback`). "Clear tuning" clears the running model's, "Reset" clears them all. The engine frame is replaced rather than the model swapped under it — a worker loads one model for its whole life — and `Tuning.reload()` re-reads the store, because the stored value did not change, only which part of it this tab is reading.

Settings never depended on a model and are kept whole across a switch, the language checkbox included — it is ignored while a multilingual model runs, never overwritten.

**Feedback propagates through `storage.onChanged` like settings do.** `onFeedbackChanged` -> `Tuning`, and `FeedFilter` requeries when the ratings on its lines differ from what the worker last received (`Tuning.signature`) — a clear, an import or a thumb in another tab. Without it a feed tab keeps the corrections it loaded at startup and the next thumb writes that copy back over a clear or an import.

## Message contract

`src/core/protocol.ts` owns the types and the guards. Both sides validate; a host page posts its own messages constantly.

```
engine  → worker   { type: 'INIT', model }              engine document to its own worker, first message, never over the port
content → engine   { id, type: 'SCORE',      texts }
content → engine   { id, type: 'SET_TOPICS', topics }
content → engine   { id, type: 'FEEDBACK',   text, liked }
                   SET_TOPICS also carries each line's liked/disliked vectors
engine  → content  { id, type: 'SCORES',     scores, topics, lines, ratings }   raw cosine, never booleans; per score: best line index, every line's cosine, near-identical rating (true/false/null)
engine  → content  { id, type: 'VECTOR',     vector }   the correction, to persist
engine  → content  { id, type: 'ACK' }                  no pending entry by design
engine  → content  { id, type: 'ERROR',      message }
engine  → content  { type: 'STATUS', state, progress?, message? }
```

**The model rides in the frame's URL** (`engine.html?model=<key>`), and the engine document forwards it to the worker as `INIT` before any port exists. It is not part of `EngineRequest` and never crosses the port: the worker must know before the first request, and a host page sharing the parent window must not get a say in which model runs. An unknown key falls back to the default rather than failing.

**Switching models replaces the frame** (`EngineClient.restart()`): pending requests resolve empty so the feed fails open, the port closes, the iframe is removed, and a new one connects on the new model. Anything in flight would otherwise answer in the old model's score space. The score cache and the language cache are cleared with it.

**The worker embeds a correction, the content script stores it.** Vectors live where the model lives; persistence lives where `storage.local` is reachable. The content script never embeds and the worker never persists.

**Raw scores, never booleans.** Moving the strictness slider re-applies the threshold over the cache with zero inference.

**Every request carries an id.** Index-order correlation breaks the moment two batches are in flight.

**Handshake:** iframe `load` → content script transfers a `MessagePort` → engine replies with its last status. Requests issued before the port opens are **buffered and drained**, not dropped; `#port?.postMessage` silently discarded the first `SET_TOPICS` and the model never loaded.

**The port goes to the extension origin only.** The iframe element lives in the host DOM, so the host page can navigate it; with `'*'` the next `load` handed the port — topics and correction vectors included — to whatever page it showed. `targetOrigin` is `runtime.getURL('/')`, which both browsers match (measured, Chrome for Testing 153 and Firefox, headless). The engine accepts the first handshake only: the host page shares the parent window and can post one too. That stops a page taking over a working channel; it does not stop a page that races the content script to the first handshake (both post from the host origin, so the engine cannot tell them apart). Such a page gets a scoring engine and FeedLens fails open.

## Status channel

A second, separate contract: content script <-> popup, over `browser.runtime` messaging. `src/platform/status-channel.ts`.

```
popup   → content  { type: 'feedlens:status?' }            to the ACTIVE tab only
content → popup    EngineStatus (the reply)
content → popup    { type: 'feedlens:status', status }     pushed on change
```

**The posts-hidden badge asks the background to open the popup** — `content → background { type: 'feedlens:open-popup' }`, `src/platform/open-popup.ts` — because `action.openPopup` is unreachable from a content script. The background honours it only from a tab (`sender.tab`).

**Asked per tab, never stored.** Each feed tab runs its own engine. A shared `storage.local` value showed whichever tab wrote last, went stale the moment the reader switched tabs, and left a durable record of when a feed was last open — see [privacy.md](privacy.md). The popup asks the active tab at open and holds the answer in memory.

**Pushes are filtered by `sender.tab.id`.** Every feed tab broadcasts; without the check a background tab's download overwrites the foreground tab's reading.

**No reply means no engine on that tab.** `tabs.sendMessage` rejecting is the answer, not an error: not a feed, or not yet injected. Distinct from state `idle`, which means injected but not started.

**Costs no permission.** The active tab's id needs none; reaching its content script is covered by `host_permissions`.

**Reported changes are throttled** — new state, or progress moved >= 5 points. Per-file download progress fires several times a second.

## Conversations

**A reply is kept when its lead post is kept.** The lead post is the one its conversation hangs from. Replies lean on context the model never sees; scored alone they blur under a post that passed.

- `Conversation` (`src/feed/conversation.ts`) is generic: verdicts per container, replies per lead post. It never reads vendor DOM.
- The adapter supplies the site part: `SiteAdapter.leadPost(container)`. Only X has one ([adapters.md](adapters.md)). `Conversation.for(adapter)` returns undefined without `leadPost`.
- `FeedFilter` touches it at three points: `route` before scoring, `settle` after every verdict and reveal click, `reset` on requery. Without one, no hook runs.
- **The post the reader opened is never filtered, on every site.** An adapter enforces it only where it breaks: X's `leadPost` returns the opened post itself (a reveal does not survive X's redraw). Reddit stands down on threads; LinkedIn already holds, checked by hand.
- `route`: post leads itself → `keep`; lead post kept → `keep` (revealed, never scored); blurred or peeked → `judge` (as any post); undecided → `wait` (held with `markPending`).
- `settle`: a changed verdict hands back the lead post's replies, re-routed through `enqueue`. Covers waiting replies, a reader reveal, and a rescore flip.
- No checkbox. Nobody wants the replies of a post they are reading blurred.

**Fail-open holds.** A held reply is never blurred; the pending state clears itself. A lead post never decided leaves its replies visible.

## Invalidation

| Change        | Effect                                                                                            |
| :------------ | :------------------------------------------------------------------------------------------------ |
| Strictness    | Re-apply threshold from cache. No inference.                                                      |
| Topics        | `epoch += 1`, clear cache, queue and conversation verdicts, new `seen` set, reveal all, re-sweep. |
| Host disabled | Reveal all, stop.                                                                                 |
| Turned on     | Same as Topics: the engine has never been sent a query.                                           |

**Epoch guards the race.** A batch in flight when topics change returns scores measured against the old vectors; replies from a previous epoch are discarded.

## Failure posture

**One `SCORE` request is in flight at a time.** The worker embeds one post after another on a single thread, so a second request does not start sooner — it waits, while its 8s timeout counts that wait against it. Without the guard, scrolling fast put a request out every time the queue refilled (the batch leaves `#pending` synchronously, before the await), and the later ones timed out on a healthy engine and revealed batches it had never reached. Posts wait in `#pending` instead, where waiting is free, and the timeout measures the engine rather than the queue behind it. `ScoreQueue` drains straight into the next batch rather than waiting out `FLUSH_MS`.

**A dropped post fails open.** A queued post whose node the page removes is dropped so nodes do not pile up behind a slow model. If that same node returns, the scanner has already offered it and does not offer it again; the skeleton failsafe reveals it unscored.

Fail-open everywhere. Unknown score, request timeout (8s), engine `ERROR`, or worker crash all **reveal**. A 15s watchdog logs (debug builds) if the engine never reports in. The worker keeps the last `SET_TOPICS` past a failed load and embeds it on the next request; a `SCORE` with no topics replies `ERROR`, never a score against nothing. No path may leave a post blurred because something broke.
