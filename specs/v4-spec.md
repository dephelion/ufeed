# Lensing v4 — Reddit Adapter

> **Status: PLAN ONLY. No DOM capture was possible.** Unlike
> [v3](v3-spec.md), which was written from three real cards in
> `.local/linkedin/`, every selector below is a **hypothesis**. Reddit returns a
> bot interstitial to any non-browser request (`www.reddit.com` HTML → challenge
> page, `/r/all/hot.json` → 403, `old.reddit.com` → challenge page), and the home
> feed needs a login regardless. **§4 is the first task and gates everything after
> it.**
>
> Two things here are decisions, not guesses, and can be settled before any
> capture: the permission model (§3) and what text a Reddit post actually offers
> the model (§5). Those are where the real risk is.
>
> Not authority on current behaviour once superseded — [`wiki-llm/`](../wiki-llm/index.md) is.

---

## 1. Problem

Lensing filters X and LinkedIn. Reddit is the third feed, and the first where
the existing design assumptions may not hold — not because of the DOM, but
because **a Reddit post is mostly a title**, and the signal a reader actually
filters on (the subreddit) is not part of the post's text at all.

Scoring, UI and storage stay site-agnostic. If this needs a change to
`SiteAdapter`, that is a finding worth recording, not a step to take quietly.

## 2. Where it runs

| Surface                       | Filter? | Why                                                                                                                      |
| :---------------------------- | :------ | :----------------------------------------------------------------------------------------------------------------------- |
| `/` home feed                 | Yes     | Mixed subscriptions, the case the extension is for.                                                                      |
| `/r/all`, `/r/popular`        | Yes     | The strongest case: no curation at all upstream.                                                                         |
| `/r/<sub>` listing            | Yes     | Same card shape; a large sub is a mixed feed.                                                                            |
| Multireddits, search listings | Yes     | Same card shape, free if the adapter keys on the card.                                                                   |
| `/comments/...` (post page)   | **No**  | A comment is not a feed item. Blurring a thread the user opened deliberately inverts the product.                        |
| `old.reddit.com`              | **No**  | A different DOM entirely. Excluded in `matches()` explicitly, so it fails visibly rather than silently matching nothing. |

The comments-page exclusion is not free: the adapter matches on hostname, so
**the content script must stand down per-path**, which neither existing adapter
does. Cheapest shape: `findPosts()` returns `[]` on a comments URL, leaving
`SiteAdapter` untouched. Confirm no scanner/observer cost is paid regardless.

## 3. Permissions — decide before building

`reddit.com` already sits in `OPTIONAL_HOSTS` in
[wxt.config.ts](../wxt.config.ts#L9), unused. v3 §2 faced the same fork for
LinkedIn and chose the default list, reasoning that _"a user installing Lensing
already wants it running on the social sites they use, so there is no value in
an extra runtime permission prompt per site."_

**Recommendation: promote Reddit to `FEED_HOSTS` and delete `OPTIONAL_HOSTS`**,
following that precedent. Keeping it optional is not a one-line choice — it
means new UI (a request button in the popup), `permissions.request()` from a
user gesture only, runtime content-script registration, and a second code path
through `isActiveOn()`. That is a feature, not a config flag, and nothing in v3
suggests the prompt buys anything.

**If the answer is "keep it optional", that is its own spec.** Do not build it
inside this one.

## 4. Capture first — task zero

Mirror v3's method exactly. Nothing below §4 is buildable until this is done.

1. Open a logged-in feed in Chrome; save the outerHTML of **one card per type**
   into `.local/reddit/` (gitignored, never committed, never sanitized into a
   test fixture — synthetic HTML only in `reddit.test.ts`).
2. Types worth capturing, each of which may be its own card shape: **text
   (selftext) post, link post, image post, gallery, video, crosspost, poll,
   promoted/ad, and a "recommended for you" module**.
3. For each, record: the card wrapper, the title node, the body node if any,
   the media node, and **whether any of it sits inside a shadow root**.

**Answer these three in the capture, in this order:**

| #   | Question                                                             | Why it decides the design                                                                                                                                                                                                                              |
| :-- | :------------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Is post content reachable from a content script?**                 | Reddit's frontend is web components (`shreddit-*`). Slotted light-DOM content is reachable; a **closed** shadow root is not, and no selector strategy recovers it. This is the one finding that can sink the adapter outright.                         |
| 2   | **Does a `document`-level MutationObserver see new cards?**          | [FeedScanner](../src/feed/scanner.ts) observes `document.documentElement` with `subtree: true`. Mutations _inside_ a shadow root do not cross that boundary. If cards append inside a shadow host, the scanner never fires and nothing is ever scored. |
| 3   | **What distinguishes a post from an ad or a recommendation module?** | Both existing adapters gate on an allowlist — X requires `article`, LinkedIn requires an `<h2>` reading `Feed post`. An unrecognised card must be _excluded by construction_, so it is never wrongly blurred. Find Reddit's equivalent marker.         |

Questions 1 and 2 are the same risk seen from two sides, and **both are
plausible blockers**. Neither existing site posed them: X and LinkedIn are
plain DOM.

## 5. The real problem: a Reddit post barely has text

This is where Reddit differs from both existing sites, and it is a scoring
question, not a DOM one.

**A link post is a title and nothing else** — roughly 40–120 characters. An
image post is a title plus an image. Only a selftext post carries prose, and
selftext posts are the minority of most feeds.

Two facts from [model.md](../wiki-llm/model.md) apply directly and pull in
opposite directions:

- **Reassuring:** _"Length does not shift e5."_ On-topic mean by post length
  ran 0.804 / 0.800 / 0.814 / 0.810 across 0–80 / 80–150 / 150–250 / 250+
  chars. A short title is not penalised the way it would have been under
  MiniLM. **The 0–80 bucket is exactly Reddit's median post.**
- **Worrying:** the whole decision lives in a **0.035-wide strip**, and that
  strip was measured on X-length prose. Nothing says a 60-character title
  separates as cleanly — fewer words means fewer chances to match, and the
  measurement to prove it either way does not exist yet.

**And `MIN_BACKING_CHARS = 30` now means something different.** On X it caught
a photo captioned "lol". On Reddit almost every image post clears 30
characters of title while still carrying all its meaning in the image, so
`blurThinMedia` will quietly stop firing on exactly the posts it was built for.
Not a bug, but the setting's hint will be lying to Reddit users.

### 5.1 The subreddit is the strongest signal and it is not in the text

`r/programming` versus `r/politics` tells a filter more than any title in
either. Today `Post.text` means _"the post's own words"_ and the subreddit is
thrown away.

Three options, in preference order:

1. **Prepend the subreddit to the text**, e.g. `"programming — <title>"`. One
   line in the adapter, no contract change. Risks: it shifts every score on the
   site, so Reddit inherits none of the band calibration; and a subreddit name
   is often a compound or a joke (`r/ExperiencedDevs`, `r/buildapc`) that e5 may
   read as noise. Bare `programming` probably beats `r/programming` — the
   prefix is not a word.
2. **Leave it out**, score the title alone. Honest, loses the best signal,
   and makes `alwaysKeep`/`alwaysBlur` on a sub name the user's only recourse —
   which already works today, for free, since overrides are substring matches
   over the post text (so this option depends on option 1 to be useful at all).
3. **Add a field to `Post`** (a `source` or `channel`) and let scoring weigh it.
   Touches the adapter contract and the engine. Out of scope here; note it if
   the measurement in §5.2 says the subreddit is worth that much.

### 5.2 Measure before choosing

The harness in `.local/spikes/topic-viability/` already does this — `collect.js`
scrapes a feed's visible text, `label.html` labels it, `score.mjs` reports AUC.
Point it at a Reddit feed and run the same comparison this repo ran for topic
phrasing:

| Variant to score      | Answers                                   |
| :-------------------- | :---------------------------------------- |
| Title only            | Is a title enough? Baseline AUC.          |
| `"<sub> — <title>"`   | Does the subreddit help, and by how much? |
| `"r/<sub> — <title>"` | Does the `r/` prefix cost anything?       |
| Title + selftext      | Does body text help where it exists?      |

**~150 labelled posts from `/r/all` is the bar**, matching the 205 the rest of
model.md rests on. Report AUC and the on/off-topic means, and if the means land
outside `0.76 – 0.83`, **Reddit needs its own band** and `MODEL.bandMin/bandMax`
stop being a single global default — which is a change to
[settings.ts](../src/core/settings.ts), not to the adapter.

That last sentence is the one that could make this spec much larger. Worth
knowing early.

## 6. Hypothesised selectors — unverified, do not build on these

Recorded so §4 has something to confirm or reject, **not so they can be typed
into an adapter**. Every row may be wrong.

| Concern   | Hypothesis                                                                                                                                                                                              |
| :-------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Container | `shreddit-post` — but the blur target is likely its card wrapper, per X's _"blur the cell, not the article"_ lesson: blurring the inner element leaves separators and padding sharp.                    |
| Post gate | Presence of `shreddit-post` itself, plus an attribute check to exclude promoted posts.                                                                                                                  |
| Title     | An attribute on `shreddit-post` (`post-title`) may carry it directly — **cheaper and far more stable than any text node**, if real.                                                                     |
| Body      | A slotted `[slot="text-body"]` region on selftext posts only.                                                                                                                                           |
| Media     | `i.redd.it` / `preview.redd.it` in an `img[src]`, plus `video`. Must **not** match subreddit icons, avatars or award icons — same asset-taxonomy approach that worked for LinkedIn's `feedshare-image`. |

**If the title really is an attribute, prefer it over DOM text.** Attributes do
not carry a "… more" toggle, do not need cloning, and survive re-render. That
would make this the cleanest of the three adapters rather than the messiest.

## 7. Task order

0. §3 permission decision. **Blocks the manifest change.**
1. §4 capture. **Blocks everything below.**
2. §5.2 measurement. **Blocks the text-extraction design**, and may add a band
   task.
3. `redditAdapter` in `src/adapters/reddit.ts` + `reddit.test.ts`, synthetic
   fixtures only.
4. Register in `src/adapters/index.ts`; host into `wxt.config.ts` and
   `content.ts` `matches`.
5. Update `wiki-llm/adapters.md`, `manifest.md`, `index.md`, and `model.md` if
   §5.2 produced numbers — same commit.

## 8. Blockers and open questions

**Blockers** — work stops until answered:

- **B1. Shadow DOM.** If post content or the feed's mutations live behind a
  closed shadow root, neither `findPosts()` nor `FeedScanner` can reach them,
  and there is no workaround from a content script. This kills the adapter, not
  just the approach. §4 Q1/Q2.
- **B2. Permission model.** §3. Optional-host is a separate feature; the
  manifest change cannot be written until this is decided. Recommendation:
  promote to default.
- **B3. v3 is still marked IN PROGRESS.** `conventions.md` allows **at most one
  active plan** in `specs/`. The LinkedIn adapter has shipped and was exercised
  against a live feed during the language-gate work, but only you can confirm it
  is verified. **v3 must be marked superseded before v4 becomes the active
  plan**, or the rule is broken by both existing at once. Related and already
  stale: `conventions.md` still names **v2** as the active plan, two versions
  behind. Whoever closes v3 should repoint it in the same commit.

**Open questions** — answer changes the design, not whether to start:

- **Q1. Is a 60-character title enough to score?** §5.2 baseline. If AUC comes
  back near chance, Reddit is not a viable surface at any threshold and this
  spec should stop rather than ship a filter that blurs at random — the same
  conclusion the v1 spike was built to be able to reach.
- **Q2. Does the subreddit go into the text?** §5.1. Recommendation: yes,
  bare name, no `r/` — pending §5.2.
- **Q3. Does Reddit need its own threshold band?** If §5.2's means fall outside
  `0.76 – 0.83`, the band stops being global and `Settings` grows a per-site
  shape. Sizeable; better known now than discovered mid-build.
- **Q4. What happens to `blurThinMedia` here?** §5. The 30-char rule barely
  fires on Reddit image posts. Options: leave it (the hint is then wrong for
  Reddit), raise the floor per-site, or treat an image post with only a title as
  thin regardless of length. No recommendation yet.
- **Q5. Should the comments page filter comments instead of standing down?**
  §2 says stand down. There is a real product question underneath — a 400-comment
  thread is a feed — but it is a different unit, a different reveal UX, and
  should not ride along here.
- **Q6. Does `old.reddit.com` ever get an adapter?** Recommendation: no. Noted
  so it is not rediscovered as an oversight.
