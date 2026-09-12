# UI & Interaction

> **Maintenance Invariant:** What the user sees and touches. Blur mechanics, reveal, popup, debug affordances. No selectors ([adapters.md](adapters.md)), no thresholds ([model.md](model.md)). Update in the SAME commit as any visible behaviour change. Token-optimized: imperative, no prose, no redundancy.
> **Answers:** What the blur does and why that technique. How a post is revealed. What the popup controls. What debug mode adds.

## The blur

`.lx-blur`, applied to the post container. `src/ui/blur.css`, shipped via `content_scripts[].css` so it applies before first paint.

| Target    | Treatment                                                   |
| :-------- | :---------------------------------------------------------- |
| Container | `opacity: .55`, `position: relative`                        |
| Text      | `color: transparent` + `text-shadow: 0 0 10px currentColor` |
| Image     | `filter: blur(64px) saturate(.25)`, `opacity: .45`          |
| Video     | `filter: blur(40px) saturate(.25)`, `opacity: .45`          |
| Label     | `::after` — "Out of topic — click to read"                  |

**Media is blurred far harder than text.** At `blur(18px)` a bright, high-contrast photo kept its shapes and its watermark readable, while a dim one looked fully hidden — same rule, different source material. That asymmetry reads as a bug and is not one.

**A still needs more radius than video.** Measured by eye on a real feed: at `blur(40px)` video was unreadable while photos still resolved. Motion denies the eye the fixation a still frame allows, so images get `64px` and video `40px`.

**Radius hides, opacity dims — never swap the two.** `opacity` multiplies with the container's `.55`, so `.32` landed media near 18% alpha and the feed went black. Recognisability is the radius' job. **No `brightness()`**: darkening is theme-hostile, hiding media on a dark feed and raising its contrast on a light one, where `opacity` blends toward whatever is behind it.

**Never `filter: blur()` on the container.** It creates a stacking context **and a containing block**, breaking `position: fixed` descendants and vendor overlays, and it is expensive across a long feed. Media is a leaf with no fixed descendants, so blurring it directly is safe.

**`aria-hidden` toggles with the class.** Blurred content is otherwise fully present to screen readers, which defeats the purpose.

**Never nest.** Blur the outermost claimed container; effects must not stack.

## Three tiers

A score does not decide blur-or-not; it picks one of three treatments ([model.md](model.md) for the band).

| Verdict | Condition                               | Treatment                           |
| :------ | :-------------------------------------- | :---------------------------------- |
| `show`  | `score >= threshold`                    | Untouched.                          |
| `peek`  | `threshold - 0.01 <= score < threshold` | Blurred, opening ~50 chars legible. |
| `blur`  | `score < threshold - 0.01`              | Blurred whole.                      |

**The peek exists so a blur can be judged without destroying it.** Clicking to check reveals the post, which is why a reveal click is worthless as a relevance signal: it cannot separate "I wanted this" from "I was checking you".

## Why a post is blurred

`data-lx-reason` on the container picks the label. It is set by `blur()` and cleared by `reveal()`.

| Reason  | Label                              | Set when                                               |
| :------ | :--------------------------------- | :----------------------------------------------------- |
| `topic` | "Out of topic — click to read"     | The score fell below the threshold, or `alwaysBlur`.   |
| `media` | "No text to check — click to view" | `blurThinMedia` and the post has media under 30 chars. |
| `peek`  | `data-lx-peek` + "— click to read" | The score landed in the uncertain strip.               |

**The peek never touches host DOM.** The opening words ride on `data-lx-peek` and render in our own overlay. Un-blurring them in place means splitting the host's text node — Invariant 3, and dead on the next vendor re-render. `reveal()` clears the attribute, so a recycled node never shows another post's words.

**The peek shares `::after` with the label, deliberately.** An element has two pseudo-elements and the score badge owns `::before`; putting the peek there would hide the badge on exactly the borderline posts worth debugging.

**The labels are not interchangeable.** A thin-media post was never judged off topic — the model never saw enough text to judge it. Saying "out of topic" there asserts a verdict that was never reached.

**The media rule is engine-independent.** It reads the DOM and the settings, never a score, so it costs no inference and cannot be reached by a scoring failure. It sits with `alwaysBlur` as user policy, not as a model verdict — that is what keeps it clear of the fail-open invariant.

`position: relative` on the container is the one accepted layout side effect — it anchors the label. Verified on X without shifting.

## Reveal

**Click only. No hover.** Scrolling drags the pointer across the feed, so hover exposed every post it passed over.

- `pointer-events: none` on `.lx-blur > *` makes the first click consumable.
- First click: reveal, `preventDefault`, `stopPropagation`. The post never navigates.
- Second click: normal interaction.
- Revealed posts are held in a `WeakSet` and never re-blurred.

**Node-level is sufficient.** A reveal lost to virtualized recycling is an accepted tradeoff, not a bug. Do not add a persistence layer for it.

## Thumbs

One floating `.lx-fb` element centred over the hovered post, appended to `documentElement`. **Never injected into a post** — a control inside the feed's DOM breaks Invariant 3 and dies on virtualized recycling.

**Centred, not in a corner.** The top-right belongs to the vendor's post menu, and the blur label sits there too. It is anchored on the post's centre point with a `translate(-50%, -50%)`, so the bar's own size never enters the maths.

Appears on any scored post, not only blurred ones: [model.md](model.md) puts the larger error mass _above_ the threshold, where posts are shown with nothing marking them as doubtful.

**Hidden unless `tuneFromFeedback` is on.** The checkbox gates the buttons and the scoring together, so a rating never has an invisible effect.

**A post is rated once.** Ratings are keyed by `hashText`, so the same thumb again un-rates it and the other thumb flips it. Both re-clicks reuse the stored vector and never reach the engine. Without this a held click stacks copies of one post into the centroid, and a mind-change leaves it pulling both ways at once. The active thumb is marked, so a repeat click reads as a toggle rather than a no-op.

The bar sits outside `.lx-blur`, so the reveal click handler never sees its clicks.

**A reveal click is not feedback.** It cannot separate "I wanted this" from "I was checking you". Only the thumbs are a label.

## Popup

| Control           | Effect                                                                   |
| :---------------- | :----------------------------------------------------------------------- |
| On                | Global switch. Off reveals everything.                                   |
| Topics + Apply    | Takes effect only on Apply, so a half-typed edit never filters a feed.   |
| Strictness        | Slider position 0..1 onto the band. Re-applies from cache, no inference. |
| Advanced band     | Loosest / strictest score the slider spans.                              |
| Blur media        | Default off. Blurs media posts under 30 chars of text.                   |
| Learn from thumbs | Advanced, default off. Applies ratings to the line they matched.         |
| Clear tuning      | Advanced. Deletes every stored correction; Reset does too.               |
| Show scores       | Advanced, default off. The only gate on the score badge, in any build.   |
| Reset             | Restores defaults, keeps topics.                                         |
| Status dot        | Engine state and backend.                                                |

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
