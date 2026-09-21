# UI & Interaction

> **Maintenance Invariant:** What the user sees and touches. Blur mechanics, reveal, popup, debug affordances. No selectors ([adapters.md](adapters.md)), no thresholds ([model.md](model.md)). Update in the SAME commit as any visible behaviour change. Token-optimized: imperative, no prose, no redundancy.
> **Answers:** What the blur does and why that technique. How a post is revealed. What the popup controls. What debug mode adds.

## The blur

`.lx-blur`, applied to the post container. `src/feed/blur.css`, shipped via `content_scripts[].css` so it applies before first paint.

| Target    | Treatment                                                              |
| :-------- | :--------------------------------------------------------------------- |
| Container | `opacity: .55`, `position: relative`                                   |
| Text      | `color: transparent` + `text-shadow: 0 0 10px currentColor`            |
| Image     | `filter: blur(64px) saturate(.25)`, `opacity: .45`                     |
| Video     | `filter: blur(40px) saturate(.25)`, `opacity: .45`                     |
| Label     | `::after` — "Out of topic — click to read", drawn from `data-lx-label` |

**Media is blurred far harder than text.** At `blur(18px)` a bright, high-contrast photo kept its shapes and its watermark readable, while a dim one looked fully hidden — same rule, different source material. That asymmetry reads as a bug and is not one.

**A still needs more radius than video.** Measured by eye on a real feed: at `blur(40px)` video was unreadable while photos still resolved. Motion denies the eye the fixation a still frame allows, so images get `64px` and video `40px`.

**Radius hides, opacity dims — never swap the two.** `opacity` multiplies with the container's `.55`, so `.32` landed media near 18% alpha and the feed went black. Recognisability is the radius' job. **No `brightness()`**: darkening is theme-hostile, hiding media on a dark feed and raising its contrast on a light one, where `opacity` blends toward whatever is behind it.

**Never `filter: blur()` on the container.** It creates a stacking context **and a containing block**, breaking `position: fixed` descendants and vendor overlays, and it is expensive across a long feed. Media is a leaf with no fixed descendants, so blurring it directly is safe.

**`aria-hidden` toggles with the class.** Blurred content is otherwise fully present to screen readers, which defeats the purpose. Its links stay focusable on purpose — `inert` would remove them from the keyboard, so a keyboard reader could never reach the post to reveal it — and focus entering a blurred post is announced instead (§Reveal).

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

`data-lx-reason` on the container picks the label. It is set by `blur()` and cleared by `reveal()`. `blur()` also writes the label's text to `data-lx-label` in the reader's language; the English shown in this page is `en`, see [i18n.md](i18n.md).

| Reason     | Label                              | Set when                                                                                 |
| :--------- | :--------------------------------- | :--------------------------------------------------------------------------------------- |
| `topic`    | "Out of topic — click to read"     | The score fell below the threshold, or a near-copy of a thumbed-down post.               |
| `media`    | "No text to check — click to view" | `blurThinMedia` and the post has media under 30 chars, or a caption CLD could not place. |
| `language` | "Another language — click to read" | `blurOtherLanguages` and CLD placed the post outside the model's language.               |
| `peek`     | `data-lx-peek` + "— click to read" | The score landed in the uncertain strip.                                                 |

**The peek never touches host DOM.** The opening words ride on `data-lx-peek` and render in our own overlay. Un-blurring them in place means splitting the host's text node — Invariant 3, and dead on the next vendor re-render. `reveal()` clears the attribute, so a recycled node never shows another post's words.

**Dim the children, never the container.** `opacity` on `.lx-blur` makes a group, and a group's own `::after` cannot exceed it — the label faded to 55% along with the post it labels. The dim lives on `.lx-blur > *`, which also carries `pointer-events: none`.

**Labels are translucent over a dark fill, never a light tint.** The first pass tinted 22% of the reason's colour and coloured the text to match — picked against X's dark feed, invisible on LinkedIn's white one. A **78%** fill of the deep shade with near-white text reads on either background and still lets the feed through, which is what keeps the label part of the page rather than pasted onto it. Each reason keeps its own colour: red for topic, indigo for language, stone for media, amber for the peek.

**Solid was tried and rejected.** It is the most legible and the most foreign — the pill stops belonging to the feed. Legibility here comes from the fill being dark and the text near-white, not from removing the transparency.

**The score badge stays translucent**, alone among them. It is a debug affordance sitting in the post's bottom-right corner, and it is meant to be read through — a solid pill there hides content the badge exists to explain.

**The peek shares `::after` with the label, deliberately.** An element has two pseudo-elements and the score badge owns `::before`; putting the peek there would hide the badge on exactly the borderline posts worth debugging.

**The labels are not interchangeable.** A thin-media post was never judged off topic — the model never saw enough text to judge it. Saying "out of topic" there asserts a verdict that was never reached.

**The media and language rules are engine-independent.** They read the DOM, the settings and CLD, never a score, so they cost no inference and cannot be reached by a scoring failure. They are user policy, not a model verdict — that is what keeps them clear of the fail-open invariant. `decideWithoutScore()` is the pair of them, asked before an inference is spent: a post they claim never reaches the engine.

**The language label carries its own colour**, indigo against the topic label's red. It is not a verdict about the subject and must not read as one — [model.md](model.md) has why the score behind it would have been noise.

**Turning the language checkbox on does not re-filter what is already on screen**, and the popup hint says so. Those posts were scanned while the setting was off, so no detection ran for them, and their scores are cached — `rescore()` re-decides them with no language to decide on. Scrolling and reloading both work; new posts are filtered normally. Accepted over the machinery to fix it: detection would have to run ahead of the score cache and the visible posts be re-offered, for one toggle a user flips once.

**`blurThinMedia` barely fires on Reddit, and that is unresolved.** The rule needs media plus under 30 characters of text; a Reddit image post carries a title that almost always clears 30 while the meaning stays entirely in the image. Options when it matters: leave it (the hint is then untrue for Reddit), raise the floor per site, or treat an image post carrying only a title as thin whatever its length. No recommendation yet — it needs a feed to argue with.

**An unplaceable post is labelled `media`, not `language`.** CLD returning unreliable says the text is too thin to read, not that it is foreign. That is the same claim `MIN_BACKING_CHARS` makes by counting characters, so it lands in the same rule and the same label, and like that rule it needs media present and `blurThinMedia` on.

`position: relative` on the container is the one accepted layout side effect — it anchors the label. Verified on X without shifting.

## While a post is being judged

`.lx-pending`, set by `showSkeleton()` when a post is found or re-held, lifted by `hideSkeleton()` when a verdict lands.

**A skeleton and a blur are separate code.** `skeleton.ts` and `skeleton.css` own the loading state; `blur.ts` and `blur.css` own verdicts; neither imports the other, and `FeedFilter` is the only place that knows both — it lifts the skeleton as it applies a verdict. Either can change without the other.

Detection and inference take a moment, and for that long a post is legible. **Left alone it draws the eye and then blurs under it** — the one moment the extension is most visible is the moment it has decided nothing.

**Everything queued is held, not just the batch at the engine.** A post waiting its turn is no more judged than the one being scored, so it looks the same. `ScoreQueue` names the batch going out _and_ everything still behind it on each flush, and `FeedFilter` holds them all. Re-announcing on every flush also keeps the failsafe timer refreshed while the queue drains, so a post that started deep in a backlog never lifts and re-holds on its way to the front.

**A settings change leaves held posts alone.** `rescore()` re-applies verdicts, and a held post has none: its missing score reads as unscored, which fails open and reveals it. Unchecking _Show each post's score_ did exactly that to every post waiting on the engine, which then showed in full until the next flush held it again. The verdict lands under whatever the settings are by then.

**The skeleton's text follows the same rule**: `showSkeleton()` writes `data-lx-pending`, `hideSkeleton()` clears it, and the stylesheet draws it.

**The skeleton is the blur pushed further, in its own file.** Same targets as `.lx-blur`, which holds up on X, LinkedIn and Reddit, only heavier. It carries a centred "Classifying…". No verdict colour, and **clicks still reach the post**. Radius does the hiding; opacity stays at the blur's values, because lower opacity multiplies down and the feed goes black (§The blur).

**Flat bars and flattened media were tried and rejected** (owner, 2026-09-20). Every text element and icon became a grey block, and on LinkedIn the post read as a broken page. On X the bars were invisible: `currentColor` on an element whose own `color` is transparent is transparent, so the post read as black. Reuse what the blur does; do not add rules that depend on host markup the blur does not already touch.

**No dimming of the container, no pulse.** Opacity on the container darkens the whole post on a dark feed and drags the host's own surface with it. The blur dims children, never the container, for the same reason.

**It clears itself after 10s**, whatever happened. A held batch, a dead worker or a detector that never answers must not leave a feed held — Invariant 2 applies to this state exactly as it applies to a blur.

**That failsafe must outlast the engine's own timeout, and at 1500ms it did not.** Every verdict clears the state, and the engine answers or fails open within 8s, so the timer should only ever fire when nothing answers at all. Sized for e5's milliseconds, it expired mid-batch on the slower model: the post showed in full and blurred a moment later, which is the exact flash this state exists to prevent. Any future per-request timeout change moves this with it.

**Held from the moment a post is found, through warm-up.** `FeedScanner.onFound` fires in the mutation callback, before the next paint; waiting for the viewport observer paints the real post once first. Waiting for the engine to be ready showed every post on load, then held it, then blurred it — the flash this state exists to prevent.

**Not held through a download.** A first-run download (`downloading`) is minutes, so the skeleton lifts when it starts and nothing is held until it ends; that first load shows one skeleton flash before the worker reports which it is. A cached load reports `warming` and is held through. The opened post (`route` says keep) is never held.

## Reveal

**Click or Enter. No hover.** Scrolling drags the pointer across the feed, so hover exposed every post it passed over.

- `pointer-events: none` on `.lx-blur > *` makes the first click consumable.
- First click: reveal, `preventDefault`, `stopPropagation`. The post never navigates.
- Enter with focus anywhere inside a blurred post does the same. X's J/K and Tab both land there; without it a keyboard reader could not reveal at all.
- Collapsed posts hide their content with `opacity: 0`, never `visibility: hidden`: hidden content cannot take focus, which left a keyboard reader no way in. `.lx-blur:focus-within::after` rings the label, since the focused element itself is invisible.
- Focus entering a blurred post is spoken through one `.lx-sr` live region of ours ("Blurred by FeedLens: out of topic. Press Enter to read it."), once per post. Cleared, then set 50ms later: a region whose text did not change is not re-read, and consecutive posts share a reason.
- Second click: normal interaction.
- Revealed posts are held in a `WeakSet` and never re-blurred.
- Revealing a post also reveals its blurred replies ([architecture.md](architecture.md) §Conversations).

**Node-level is sufficient.** A reveal lost to virtualized recycling is an accepted tradeoff, not a bug. Do not add a persistence layer for it.

## Thumbs

One floating `.lx-fb` element top-centred over the hovered post, appended to `documentElement`. **Never injected into a post** — a control inside the feed's DOM breaks Invariant 3 and dies on virtualized recycling.

**Top-centred, not in a corner.** The top-right belongs to the vendor's post menu, and the blur label sits there too. It is anchored horizontally on the post's centre point with a `translate(-50%, 0)`, and vertically on the post's top edge, so the bar's own width never enters the maths.

Hidden on a post its conversation kept (`Conversation.keeps`): the opened post and replies to a kept lead post were never judged, so there is nothing to rate ([architecture.md](architecture.md) §Conversations).

Appears on shown and revealed posts, never on a blurred one (`postAt` skips it; reveal first): [model.md](model.md) puts the larger error mass _above_ the threshold, where posts are shown with nothing marking them as doubtful.

**Hidden unless `tuneFromFeedback` is on.** The checkbox gates the buttons and the scoring together, so a rating never has an invisible effect.

**A rating is only as good as the post text.** A rating overrides only posts whose text embedding is near-identical to the rated one ([model.md](model.md) §Relevance feedback) — it never sees images or video. Rating a post whose meaning lives in the media, over a neutral caption, matches other posts on words that were never the point. The popup hint asks for text-carrying posts only; nothing enforces it, same as `blurThinMedia` trusting caption length (`MIN_BACKING_CHARS`) rather than reading the frame.

**A post is rated once.** Ratings are keyed by `hashText`, so the same thumb again un-rates it and the other thumb flips it. Both re-clicks reuse the stored vector and never reach the engine. Without this a held click stores copies of one post, and a mind-change leaves it rated both ways at once. The active thumb is marked, so a repeat click reads as a toggle rather than a no-op.

**Disabled while the engine is busy.** `EngineClient.busy` is true until the model is ready and while any request waits on the worker. A thumb sent then queues behind scoring and could pass the 8s request timeout, dropping the rating silently. The buttons dim (`.lx-fb-busy`), say "Checking posts, one moment", and ignore clicks; batches finish in well under a second.

The bar sits outside `.lx-blur`, so the reveal click handler never sees its clicks.

**A reveal click is not feedback.** It cannot separate "I wanted this" from "I was checking you". Only the thumbs are a label.

## Popup

| Control                           | Effect                                                                                                                                                           |
| :-------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| On                                | Global switch. Off reveals everything.                                                                                                                           |
| Topics + Apply                    | Takes effect only on Apply, so a half-typed edit never filters a feed. One striped row per topic, never wrapped.                                                 |
| Strictness                        | 0-10 slider, default 7; each step is a measured threshold. Re-applies from cache, no inference. 0 blurs nothing.                                                 |
| Model                             | Right under the slider. English (33MB, default) or every language (197MB). Switching restarts the engine and downloads on first use.                             |
| Blur media                        | Default off. Blurs media posts under 30 chars of text.                                                                                                           |
| Blur posts that aren't in English | Default on. Blurs posts outside the model's language; off skips detection. **Disabled** while a multilingual model runs.                                         |
| Collapse blurred posts            | Default on. Shrinks a blurred or peeked post to a thin row over the host's own background instead of leaving it full height.                                     |
| Learn from thumbs                 | Its own block, in the main flow. Checkbox, kept/blurred/rated counts, clear.                                                                                     |
| Clear tuning                      | In that block. Deletes every correction; Reset does too.                                                                                                         |
| Show scores                       | Default off. The only gate on the score badge, in any build.                                                                                                     |
| Export / Import                   | Own block above Reset. Writes a backup file; reads one back, replacing settings and ratings. Imports on select, no confirm.                                      |
| Reset                             | Own block, explained where it sits: restores defaults, deletes every rating, keeps topics and language.                                                          |
| Language                          | Header, a flag right after the title. Opens the browser's own list, each entry flag first. Sets the language of the popup and the feed ([i18n.md](i18n.md)).     |
| Engine chip                       | Header, centred between the title and the switch. Two or three words plus a light.                                                                               |
| Footer                            | Settings line, engine line, "📥 Report an issue or share an idea" link to the GitHub issue chooser, GitHub mark linking to the repo (same row, no added height). |

**The popup follows the reader's language, the browser's until one is picked.** A control's text is a key filled at load ([i18n.md](i18n.md)); it never changes what a control does. Hints keep the rules below in every language.

**Hints speak in outcomes, not cosines, and not in the vocabulary of the thing that makes them.** _"Stricter hides more, including some posts you'd want. Blurred posts stay one click away."_ No model, no score, no embedding: a reader who has never met either must be able to predict what a control does. **No cosine reaches the hint at all**, not even behind `showScores`: the cut score is on the badge, over the post it judged, where it means something. In the popup it is a leaked implementation detail.

**State the trade-off, never a measured share.** The strictness hint reads _"Stricter hides more, including some posts you'd want. Blurred posts stay one click away."_ at every step but 0. It once quoted the step table ("about 30% of a typical feed … about 4 in 10 … really match"); those numbers come from one feed and one topic family, and read as a promise to every reader. Let the reader judge from their own feed; the numbers stay in [model.md](model.md). Never quote only the good half: say that stricter also costs wanted posts. Say what a control does to the feed, then what happens if it is off. Name the limitation plainly where one exists — FeedLens reads words and not pictures, it understands English and not other languages, it matches subjects and not quality. Those three sentences do more than any accuracy claim.

Topic guidance lives behind a disclosure; the measured rules are in [model.md](model.md).

Apply is disabled until the textarea differs from what is saved.

**Engine state is shown twice, on purpose.** The popup runs past Chrome's 600px cap, so the footer opens below the fold — the header chip is the only engine state most readers ever see (`Downloading 45%`, `Ready · wasm`, `Failed`, `No feed here`). The footer line carries what will not fit in a 380px header row: that the download happens once, and the failure reason a bug report needs. It hides itself once ready, when the chip says everything left to say. Both lights read from one tone, so they can never disagree.

**Destructive controls explain themselves where they sit.** Reset was a bare ghost button in the footer that silently deleted every thumb rating.

**Backup is one row and one line, and never more.** Two ghost buttons; under them a single line carrying the file name, truncated with `text-overflow: ellipsis` on a `min-width: 0` flex child so a long name gives up width and the outcome never does. **The line belongs to import.** An `<a download>` reports nothing back — a cancelled save dialog is indistinguishable from a saved file without the `downloads` permission — so export says nothing and leaves the outcome to the browser's own download UI. It said "saved" once, over an open dialog the reader then cancelled. `data-state` on that line, `ok` or `bad`, is what the styling reads. No dialog, no panel, no second line: the popup is already past the 600px cap and this may not add height beyond that one line.

**Import replaces on select, with no confirmation**, matching Reset, which destroys nearly as much on one click. A file is refused whole — settings included — when the schema is newer, the model does not match, or the JSON is not a backup; a refusal writes nothing. A settings field of the wrong type falls back to its default rather than refusing the file. The line is transient. The durable proof an import landed is the topics box and the thumb counts re-rendering above it. Export is disabled with nothing to export.

**Firefox imports in a tab.** Firefox closes the popup when the file picker takes focus; `change` fires into a dead page. On Firefox (`import.meta.env.FIREFOX`), Import opens `popup.html?tab` and closes the popup. The tab needs a second click: a picker opens only on user activation. Chrome keeps the in-popup picker.

**The model selector sits directly under the strictness slider**, above every checkbox: it changes what the other controls mean, so it is read before them and not buried in the block of toggles.

**A disabled control must say why, and keep the reader's setting.** With a multilingual model there is nothing for the language checkbox to gate, so it is disabled and a line appears saying it is off because the model reads every language and that the setting is kept for a switch back. Silently unchecking it would look like FeedLens overrode a choice; leaving it live would be a lie.

**Say the download size on the option itself**, not only in the details. 197MB is the whole cost of the choice, and a reader deciding between two options should not have to open anything to see it.

**A switch keeps everything.** Topics, strictness and every checkbox survive; ratings are kept per model and come back on a switch back ([architecture.md](architecture.md)). The details text says so, because "switching models" otherwise reads as a thing that might cost the reader their work.

## No-topics card

On, and no topics — the one inactive state the reader did not choose. The feed looks untouched, which reads as a broken install rather than an unfinished setup. `needsTopics()` in `settings.ts`, card in `src/feed/nudge.ts`.

Fixed top-right, same dark chip as the thumbs bar so it reads the same on a light and a dark feed. Shows the toolbar icon, because finding that button is the actual task.

**It cannot open the popup itself.** `action.openPopup` is unreachable from a content script, so the card points at the icon instead. The counter asks the background to do it (§Posts-hidden counter).

**Turning FeedLens off is the second option, offered on the card.** The `x` hides it for this page load only — persisting a dismissal leaves a silent extension and no route back to the explanation.

**Mounted outside the active gate**, and it polls briefly for `document.body`: the content script runs at `document_start`.

**Mount removes any existing `.lx-nudge`.** Firefox kills the old content script on extension reload/update but keeps its DOM: a card with a dead `x` and stale "no topics".

## Posts-hidden counter

A badge, bottom-left: the toolbar icon and "Posts hidden: N". A click opens the popup. `src/feed/hidden-badge.ts`, wired in `content.ts`.

**It counts posts, not nodes.** `FeedFilter` keeps the content hashes of the posts it is hiding — blur, peek, media and language alike — so a post X remounts as a new node counts once. A reveal, a loosened strictness and a re-judged post take one out; a topic or model change, turning FeedLens off, or an engine error clears it. It is the posts hidden now among those seen since load, not everything ever hidden. Two posts with identical text count once.

**Shown while FeedLens is active, zero included.** "Posts hidden: 0" is how a quiet feed says the filter is on. Off, or on with no topics (the nudge's state), it is hidden. **Also hidden in a narrow window**: hosts swap to a bottom navigation bar there, which would cover it. It is a width rule in `blur.css`, not a phone check, so a small desktop window behaves the same.

**The click asks the background.** `platform/open-popup.ts` sends `feedlens:open-popup` and the background calls `action.openPopup()`. Chrome allows that from 127 and the manifest floor is 111; Firefox documents it as user-action-only and this path is unverified there. Where it refuses, the click does nothing and debug builds log why.

**Mount removes any existing `.lx-count`**, for the same Firefox reason as the card. It attaches to `<html>`, like the thumbs bar, so it does not wait for `<body>`.

## Debug mode

On in `npm run watch` and `npm run build:debug`, **compiled out of `npm run build`**. Single gate: `src/core/debug.ts`.

- Per-layer console logs, prefixed `[feedlens:<scope>]`.

Debug mode does **not** turn the score badge on; the setting is its only gate.

**Never log post text.** Counts, scores, states, errors and topic strings only — topics are user config, post text is not. See [privacy.md](privacy.md).

## Score badge

`score 0.793 / needs 0.795 · 105 chars · #1 0.793 · #2 0.791 · #3 0.760 · marked off topic` on every scored post, from `data-lx-*` attributes stamped by the content script (`src/feed/score-badge.ts`). Every line's score is always shown, by 1-based position; the score is the highest of them. The lines are absent when the post has none (unscored). A hover swap that hid them behind `ℹ️ 3 topics` was removed in 0.7.0: the scores are the point of the badge. `needs` is the strictness threshold. The last field appears when a near-identical rated post decided the verdict (not when the media or language rule, or a kept conversation did), and on every revealed post with a rating — a revealed post is never re-blurred, so the badge is the only sign a thumb registered, and the colour follows that verdict, not the score. Wording is "marked on/off topic", never liked/disliked: a thumb judges topic fit, not the post.

**"Downloading" must mean bandwidth, and only transformers.js knows — so ask the cache instead.** A cache hit is streamed through the same `progress` events as a real fetch (Chrome; Firefox fires a single 100%), and the callback never says which it was, so **every page refresh claimed to be downloading the model again**. `Embedder` now checks `caches.open('transformers-cache')` for a key carrying the model id before loading, and reports `warming` rather than `downloading` when the weights are already there. A cached load is not instant — a few hundred MB off disk plus session startup — so the reader is still told the engine is working: "Starting the model up — already downloaded". An unreadable cache reads as "not cached", which is the old behaviour and never blocks a load.

**The log line answers "is it really re-downloading?"** `loading model … cached=true|false` on every load. Repeated `cached=false` on the same site is eviction or storage partitioning, not this labelling bug.

**An unscored post says so, and never borrows the threshold's words.** When the engine times out, errors, or never answers, the post is revealed (fail-open) and the badge reads `not scored — engine did not answer · 105 chars`. It kept the normal template before — `score none / needs 0.188` in red — which states the one thing that did not happen: the post did not fall short of the threshold, it was never measured against it. The red stays, because something did go wrong; only the claim changes. `[data-lx-score='none']` is the last content rule so it wins, which is safe because an unscored post carries no lines and no rating.

**Position, never the topic text.** `data-lx-*` sits in the vendor's DOM, readable by the site's own scripts; a topic string would hand them the reader's interests.

**Bottom-right corner.** Top-left sat under the thumbs bar, which is centred on the post's top edge, and pushed the peek text down. Bottom-right meets nothing on a full-height post. A collapsed row grows to 46px with its label at the top, so the badge fits underneath.

**Stays English in every language**: a diagnostic readout, and its screenshots reach bug reports ([i18n.md](i18n.md)). The popup hint for it says so.

**Gated solely on `settings.showScores`** (default off) — identical in a dev and a release build, so what is debugged is what ships. Turning it off, or going inactive, strips the attributes; a stale badge must never outlive the setting.
