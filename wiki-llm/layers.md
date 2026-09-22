# Layers

> **Maintenance Invariant:** Code layering only: rings, ports, where code goes, what enforces it. Runtime contexts (content script, iframe, worker) are [architecture.md](architecture.md). Update in the SAME commit as any new folder, port or ring rule, and keep the `RING` map in `src/architecture.test.ts` identical to the table below. Token-optimized: imperative, no prose, no redundancy.
> **Answers:** Which folder does new code go in? Which way may imports point? What is a port here? What enforces the Dependency Rule?

## The rule

Clean Architecture's Dependency Rule ([Uncle Bob](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html)): **source code dependencies point inward only.** Nothing in an inner ring knows anything about an outer ring — no import, no type, no name. Type-only imports count.

```
┌─ entrypoints/ ─────────────────────────────────────────────────────────────┐
│  wires it all: content script · popup · background · engine                │
│  ┌─ adapters/ · platform/ ──────────────────────────────────────────────┐  │
│  │  X · LinkedIn · Reddit       storage · messaging · model runtime     │  │
│  │  ┌─ feed/ ────────────────────────────────────────────────────────┐  │  │
│  │  │  the page: find posts, score them, blur, reveal                │  │  │
│  │  │  ┌─ core/ ──────────────────────────────────────────────────┐  │  │  │
│  │  │  │  the rules: scoring · blur policy · settings             │  │  │  │
│  │  │  └──────────────────────────────────────────────────────────┘  │  │  │
│  │  └────────────────────────────────────────────────────────────────┘  │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────────┘
                          imports point inward only
```

## Rings

| Ring | Folder         | Holds                                                                                                                                                                                                                                                                       | May import                   | May touch             |
| :--- | :------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--------------------------- | :-------------------- |
| 1    | `core/`        | uFeed's rules: model constants, scoring, the blur policy, settings and ratings shapes, language, media and keyword blacklist rules, the engine message contract, status text, message keys, the `Translate` type, the popup's language list, backup format, caches, logging | `core/`                      | Plain JavaScript only |
| 2    | `feed/`        | The host page: `FeedFilter`, scanner, queue, conversations, tuning, blur, score badge, thumbs bar, no-topics card, and `ports.ts`                                                                                                                                           | `core/`, `feed/`             | The DOM               |
| 3    | `adapters/`    | One site's DOM knowledge each; implements `SiteAdapter`                                                                                                                                                                                                                     | `core/`, `feed/`, own folder | The DOM               |
| 3    | `platform/`    | Extension APIs and libraries: storage, runtime messaging, the engine client (iframe + port), the embedder (transformers.js)                                                                                                                                                 | `core/`, `feed/`, own folder | Anything              |
| 4    | `entrypoints/` | WXT entry files. Build the concrete pieces and plug them into ports. Nothing imports them.                                                                                                                                                                                  | Anything                     | Anything              |

- **Same ring, different folder: never.** `adapters/` and `platform/` do not import each other.
- **Packages** (`webextension-polyfill`, `@huggingface/transformers`, `wxt`) enter at ring 3 or 4 only.
- **Tests are exempt.** A test may wire across rings, like an entrypoint. A test of a ring-2 module still prefers fakes of its ports over real ring-3 code.

## Ports

`src/feed/ports.ts` — everything the feed needs from outside its ring, and nothing else. Outer rings implement; entrypoints wire.

| Port                  | Implemented by                                         | Wired in                        |
| :-------------------- | :----------------------------------------------------- | :------------------------------ |
| `SiteAdapter`, `Post` | `adapters/x.ts` · `linkedin.ts` · `reddit.ts`          | `content.ts` via `adapterFor()` |
| `Engine`              | `platform/engine-client.ts`                            | `content.ts`                    |
| `FeedbackStore`       | `platform/storage.ts` (`feedbackStore`)                | `content.ts` → `Tuning.load()`  |
| `DetectLanguage`      | `browser.i18n.detectLanguage`                          | `content.ts` → `FeedFilter`     |
| `Translate`           | `platform/i18n.ts` (`getMessage`, or `loadTranslator`) | `content.ts`, `popup.ts`        |

The no-topics card takes its icon URL as a plain argument; no port needed for one string.

**`Translate` is defined in `core/`, not `ports.ts`**: `core/engine-status.ts` needs it too, and `core/` may not import `feed/`. Feed modules take it as an argument. `core/` never returns UI prose except through it; `importConfig` returns a refusal code and the popup words it ([i18n.md](i18n.md)).

**A new port is a decision, not a convenience.** Add one only when an inner ring needs something only an outer ring can do. A port with one method and one caller can be a function type (`DetectLanguage`).

## Where does new code go?

First match wins.

1. Pure: data in, data out, no DOM, no browser, no package → `core/`.
2. Reads or changes the host page's DOM → `feed/`.
3. Knows one site's markup → `adapters/`.
4. Calls an extension API (`browser.*`) or a package → `platform/`, behind a port if `feed/` needs it.
5. Only creates things and connects them → `entrypoints/`.

A module that fits two answers is two modules. Split it along the ring line: the rule to `core/`, the I/O outward. Examples: `core/settings.ts` (shape, defaults, validation) and `platform/storage.ts` (read, write, listen); `core/language.ts` (the verdict) and `feed/language-cache.ts` (caching detections behind `DetectLanguage`).

## Enforced

`src/architecture.test.ts`, in `npm test` and therefore `npm run check` and CI. No dependency: it reads every source file's imports. It fails when:

- a source file sits outside the five folders;
- an import points outward, or sideways between `adapters/` and `platform/`;
- `core/`, `feed/` or `adapters/` import a package;
- `core/` names a browser global (`document.`, `window.`, `navigator.`, `browser.`, `chrome.`) or a DOM type;
- the worker's import graph reaches `webextension-polyfill`, which throws outside an extension page.

A failure prints `file -> import`. Fix the import, never the test. Changing a ring rule means changing this page and the test's `RING` map in the same commit.

## Deviations from the textbook

- **The DOM is allowed in ring 2.** Textbook puts the UI outermost. uFeed's job is editing a page's DOM; a `Page` port would need ~10 methods with one implementation. The platform stays out of `feed/` instead, so each ring tests with less: `core/` with nothing, `feed/` with happy-dom, `platform/` with the fake browser.
- **Four rings, not textbook names.** `core/` is entities plus use-case rules that need no I/O; `feed/` is the use case that drives the page. Folder names predate the rings and stay.
- **`core/log.ts` is in ring 1.** `console` exists in every realm, and the debug flag is a build constant (`core/debug.ts`), not a runtime dependency.
