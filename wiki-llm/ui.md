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

| Reason     | Label                              | Set when                                                                                 |
| :--------- | :--------------------------------- | :--------------------------------------------------------------------------------------- |
| `topic`    | "Out of topic — click to read"     | The score fell below the threshold, or `alwaysBlur`.                                     |
| `media`    | "No text to check — click to view" | `blurThinMedia` and the post has media under 30 chars, or a caption CLD could not place. |
| `language` | "Another language — click to read" | `blurOtherLanguages` and CLD placed the post outside the model's language.               |
| `peek`     | `data-lx-peek` + "— click to read" | The score landed in the uncertain strip.                                                 |

**The peek never touches host DOM.** The opening words ride on `data-lx-peek` and render in our own overlay. Un-blurring them in place means splitting the host's text node — Invariant 3, and dead on the next vendor re-render. `reveal()` clears the attribute, so a recycled node never shows another post's words.

**Dim the children, never the container.** `opacity` on `.lx-blur` makes a group, and a group's own `::after` cannot exceed it — the label faded to 55% along with the post it labels. The dim lives on `.lx-blur > *`, which also carries `pointer-events: none`.

**Labels are translucent over a dark fill, never a light tint.** The first pass tinted 22% of the reason's colour and coloured the text to match — picked against X's dark feed, invisible on LinkedIn's white one. A **78%** fill of the deep shade with near-white text reads on either background and still lets the feed through, which is what keeps the label part of the page rather than pasted onto it. Each reason keeps its own colour: red for topic, indigo for language, stone for media, amber for the peek.

**Solid was tried and rejected.** It is the most legible and the most foreign — the pill stops belonging to the feed. Legibility here comes from the fill being dark and the text near-white, not from removing the transparency.

**The score badge stays translucent**, alone among them. It is a debug affordance sitting over the post's own first line, and it is meant to be read through — a solid pill there hides content the badge exists to explain.

**The peek shares `::after` with the label, deliberately.** An element has two pseudo-elements and the score badge owns `::before`; putting the peek there would hide the badge on exactly the borderline posts worth debugging.

**The labels are not interchangeable.** A thin-media post was never judged off topic — the model never saw enough text to judge it. Saying "out of topic" there asserts a verdict that was never reached.

**The media and language rules are engine-independent.** They read the DOM, the settings and CLD, never a score, so they cost no inference and cannot be reached by a scoring failure. They sit with `alwaysBlur` as user policy, not as a model verdict — that is what keeps them clear of the fail-open invariant. `decideWithoutScore()` is the pair of them plus the overrides, asked before an inference is spent: a post they claim never reaches the engine.

**The language label carries its own colour**, indigo against the topic label's red. It is not a verdict about the subject and must not read as one — [model.md](model.md) has why the score behind it would have been noise.

**Turning the language checkbox on does not re-filter what is already on screen**, and the popup hint says so. Those posts were scanned while the setting was off, so no detection ran for them, and their scores are cached — `rescore()` re-decides them with no language to decide on. Scrolling and reloading both work; new posts are filtered normally. Accepted over the machinery to fix it: detection would have to run ahead of the score cache and the visible posts be re-offered, for one toggle a user flips once.

**`blurThinMedia` barely fires on Reddit, and that is unresolved.** The rule needs media plus under 30 characters of text; a Reddit image post carries a title that almost always clears 30 while the meaning stays entirely in the image. Options when it matters: leave it (the hint is then untrue for Reddit), raise the floor per site, or treat an image post carrying only a title as thin whatever its length. No recommendation yet — it needs a feed to argue with.

**An unplaceable post is labelled `media`, not `language`.** CLD returning unreliable says the text is too thin to read, not that it is foreign. That is the same claim `MIN_BACKING_CHARS` makes by counting characters, so it lands in the same rule and the same label, and like that rule it needs media present and `blurThinMedia` on.

`position: relative` on the container is the one accepted layout side effect — it anchors the label. Verified on X without shifting.

## While a post is being judged

`.lx-pending`, set by `markPending()` when a post is handed to the detector or the engine, cleared by `blur()`, `reveal()` and `revealAll()`.

Detection and inference take milliseconds, and for that long a post is legible. **Left alone it draws the eye and then blurs under it** — the one moment the extension is most visible is the moment it has decided nothing.

Deliberately unlike a blur: no label, no verdict colour, `opacity: .72` with text at `6px` and media at `20px`, a slow pulse, and **clicks still reach the post**. It reads as working, not as hidden.

**It clears itself after 1500ms**, whatever happened. A held batch, a dead worker or a detector that never answers must not leave a feed dimmed — Invariant 2 applies to this state exactly as it applies to a blur.

**Nothing is held while the engine is warming.** That wait is a model download, not milliseconds, and dimming a feed through it would be the bug this state exists to prevent.

## Reveal

**Click only. No hover.** Scrolling drags the pointer across the feed, so hover exposed every post it passed over.

- `pointer-events: none` on `.lx-blur > *` makes the first click consumable.
- First click: reveal, `preventDefault`, `stopPropagation`. The post never navigates.
- Second click: normal interaction.
- Revealed posts are held in a `WeakSet` and never re-blurred.

**Node-level is sufficient.** A reveal lost to virtualized recycling is an accepted tradeoff, not a bug. Do not add a persistence layer for it.

## Thumbs

One floating `.lx-fb` element top-centred over the hovered post, appended to `documentElement`. **Never injected into a post** — a control inside the feed's DOM breaks Invariant 3 and dies on virtualized recycling.

**Top-centred, not in a corner.** The top-right belongs to the vendor's post menu, and the blur label sits there too. It is anchored horizontally on the post's centre point with a `translate(-50%, 0)`, and vertically on the post's top edge, so the bar's own width never enters the maths.

Appears on any scored post, not only blurred ones: [model.md](model.md) puts the larger error mass _above_ the threshold, where posts are shown with nothing marking them as doubtful.

**Hidden unless `tuneFromFeedback` is on.** The checkbox gates the buttons and the scoring together, so a rating never has an invisible effect.

**A rating is only as good as the post text.** [model.md](model.md)'s Rocchio update pulls the topic vector toward `mean(liked)` and away from `mean(disliked)` using the post's text embedding — it never sees images or video. Rating a post whose meaning lives in the media, over a neutral caption, teaches the topic from words that were never the point. The popup hint asks for text-carrying posts only; nothing enforces it, same as `blurThinMedia` trusting caption length (`MIN_BACKING_CHARS`) rather than reading the frame.

**A post is rated once.** Ratings are keyed by `hashText`, so the same thumb again un-rates it and the other thumb flips it. Both re-clicks reuse the stored vector and never reach the engine. Without this a held click stacks copies of one post into the centroid, and a mind-change leaves it pulling both ways at once. The active thumb is marked, so a repeat click reads as a toggle rather than a no-op.

The bar sits outside `.lx-blur`, so the reveal click handler never sees its clicks.

**A reveal click is not feedback.** It cannot separate "I wanted this" from "I was checking you". Only the thumbs are a label.

## Popup

| Control                           | Effect                                                                                                           |
| :-------------------------------- | :--------------------------------------------------------------------------------------------------------------- |
| On                                | Global switch. Off reveals everything.                                                                           |
| Topics + Apply                    | Takes effect only on Apply, so a half-typed edit never filters a feed.                                           |
| Strictness                        | 0-10 slider, default 7; each step is a measured threshold. Re-applies from cache, no inference. 0 blurs nothing. |
| Blur media                        | Default off. Blurs media posts under 30 chars of text.                                                           |
| Blur posts that aren't in English | Default off. Blurs posts outside the model's language; off skips detection.                                      |
| Learn from thumbs                 | Advanced, its own section. Checkbox, kept/blurred/rated counts, clear.                                           |
| Clear tuning                      | In that section. Deletes every correction; Reset does too.                                                       |
| Show scores                       | Advanced, default off. The only gate on the score badge, in any build.                                           |
| Reset                             | Restores defaults, keeps topics.                                                                                 |
| Status dot                        | Engine state and backend.                                                                                        |

**Hints speak in outcomes, not cosines, and not in the vocabulary of the thing that makes them.** _"Keeps about 35% of a typical feed visible. The rest is blurred, one click away."_ No model, no score, no embedding: a reader who has never met either must be able to predict what a control does. **No cosine reaches the hint at all**, not even behind `showScores`: the cut score is on the badge, over the post it judged, where it means something. In the popup it is a leaked implementation detail.

**Admit what still gets through.** The strictness hint names how much of a feed survives _and_ how much of that is actually wanted — _"about 4 in 10 of the posts you see will really match your topics"_ — because at every step most or much of what survives is unwanted, and quoting only the good half is a lie the first scroll exposes. As a ratio of **what the reader sees**, never a bare percentage: "60% junk" leaves 60% of what unanswered. Say what a control does to the feed, then what happens if it is off. Name the limitation plainly where one exists — Lensing reads words and not pictures, it understands English and not other languages, it matches subjects and not quality. Those three sentences do more than any accuracy claim.

Topic guidance lives behind a disclosure; the measured rules are in [model.md](model.md).

Apply is disabled until the textarea differs from what is saved.

## Debug mode

On in `npm run watch` and `npm run build:debug`, **compiled out of `npm run build`**. Single gate: `src/core/debug.ts`.

- Per-layer console logs, prefixed `[lensing:<scope>]`.

Debug mode does **not** turn the score badge on; the setting is its only gate.

**Never log post text.** Counts, scores, states, errors and topic strings only — topics are user config, post text is not. See [privacy.md](privacy.md).

## Score badge

`score 0.793 / needs 0.795 · 105 chars` on every scored post, from `data-lx-*` attributes stamped by the content script (`src/content/score-badge.ts`).

**Gated solely on `settings.showScores`** (Advanced, default off) — identical in a dev and a release build, so what is debugged is what ships. Turning it off, or going inactive, strips the attributes; a stale badge must never outlive the setting.
