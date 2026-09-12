# UI & Interaction

> **Maintenance Invariant:** What the user sees and touches. Blur mechanics, reveal, popup, debug affordances. No selectors ([adapters.md](adapters.md)), no thresholds ([model.md](model.md)). Update in the SAME commit as any visible behaviour change. Token-optimized: imperative, no prose, no redundancy.
> **Answers:** What the blur does and why that technique. How a post is revealed. What the popup controls. What debug mode adds.

## The blur

`.lx-blur`, applied to the post container. `src/ui/blur.css`, shipped via `content_scripts[].css` so it applies before first paint.

| Target    | Treatment                                                   |
| :-------- | :---------------------------------------------------------- |
| Container | `opacity: .55`, `position: relative`                        |
| Text      | `color: transparent` + `text-shadow: 0 0 10px currentColor` |
| Media     | `filter: blur(18px) saturate(.4)`, `opacity: .5`            |
| Label     | `::after` — "Out of topic — click to read"                  |

**Never `filter: blur()` on the container.** It creates a stacking context **and a containing block**, breaking `position: fixed` descendants and vendor overlays, and it is expensive across a long feed. Media is a leaf with no fixed descendants, so blurring it directly is safe.

**`aria-hidden` toggles with the class.** Blurred content is otherwise fully present to screen readers, which defeats the purpose.

**Never nest.** Blur the outermost claimed container; effects must not stack.

`position: relative` on the container is the one accepted layout side effect — it anchors the label. Verified on X without shifting.

## Reveal

**Click only. No hover.** Scrolling drags the pointer across the feed, so hover exposed every post it passed over.

- `pointer-events: none` on `.lx-blur > *` makes the first click consumable.
- First click: reveal, `preventDefault`, `stopPropagation`. The post never navigates.
- Second click: normal interaction.
- Revealed posts are held in a `WeakSet` and never re-blurred.

**Node-level is sufficient.** A reveal lost to virtualized recycling is an accepted tradeoff, not a bug. Do not add a persistence layer for it.

## Popup

| Control        | Effect                                                                   |
| :------------- | :----------------------------------------------------------------------- |
| On             | Global switch. Off reveals everything.                                   |
| Topics + Apply | Takes effect only on Apply, so a half-typed edit never filters a feed.   |
| Strictness     | Slider position 0..1 onto the band. Re-applies from cache, no inference. |
| Advanced band  | Loosest / strictest score the slider spans.                              |
| Show scores    | Advanced, default off. The only gate on the score badge, in any build.   |
| Reset          | Restores defaults, keeps topics.                                         |
| Status dot     | Engine state and backend.                                                |

Hints speak in outcomes, not cosines: _"Shows roughly 35% of a feed (score 0.784 and up)."_ Topic guidance lives behind a disclosure; the measured rules are in [model.md](model.md).

Apply is disabled until the textarea differs from what is saved.

## Debug mode

On in `npm run watch` and `npm run build:debug`, **compiled out of `npm run build`**. Single gate: `src/core/debug.ts`.

- Per-layer console logs, prefixed `[lensing:<scope>]`.

Debug mode does **not** turn the score badge on; the setting is its only gate.

**Never log post text.** Counts, scores, states, errors and topic strings only — topics are user config, post text is not. See [privacy.md](privacy.md).

## Score badge

`score 0.793 / needs 0.795 · 105 chars` on every scored post, from `data-lx-*` attributes stamped by the content script (`src/content/score-badge.ts`).

**Gated solely on `settings.showScores`** (Advanced, default off) — identical in a dev and a release build, so what is debugged is what ships. Turning it off, or going inactive, strips the attributes; a stale badge must never outlive the setting.
