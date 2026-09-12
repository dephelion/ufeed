# Lensing v4 — Reddit Adapter

> **Status: DOM VERIFIED, scoring unmeasured.** Findings below come from one
> logged-in home-feed capture (`.local/reddit/feed.html`, gitignored, never
> committed): **25 posts, 4 ads, 6 carousel cards**. Subreddit listings were
> confirmed to use the same card shape. Not captured: a poll, and a live scroll
> to watch nodes append.
>
> **The DOM turned out to be the easy part** — Reddit hands the adapter more
> structured data than either existing site. What is unmeasured is whether a
> Reddit post carries enough text to score at all (§5).
>
> Not authority on current behaviour once superseded — [`wiki-llm/`](../wiki-llm/index.md) is.

---

## 1. Problem

Lensing filters X and LinkedIn. Reddit is the third feed, and the first where
the **scoring** assumptions may not hold: 17 of the 25 captured posts carry
nothing but a title.

Scoring, UI and storage stay site-agnostic. If this needs a change to
`SiteAdapter`, that is a finding worth recording, not a step to take quietly.

## 2. Where it runs

| Surface                       | Filter? | Why                                                                                                                      |
| :---------------------------- | :------ | :----------------------------------------------------------------------------------------------------------------------- |
| `/` home feed                 | Yes     | The capture. Mixed subscriptions, the case the extension is for.                                                         |
| `/r/<sub>` listing            | Yes     | Confirmed same card shape.                                                                                               |
| `/r/all`, `/r/popular`        | Yes     | The strongest case: no curation at all upstream.                                                                         |
| Multireddits, search listings | Yes     | Same card shape, free if the adapter keys on the card.                                                                   |
| `/comments/...` (post page)   | **No**  | A comment is not a feed item. Blurring a thread the user opened deliberately inverts the product.                        |
| `old.reddit.com`              | **No**  | A different DOM entirely. Excluded in `matches()` explicitly, so it fails visibly rather than silently matching nothing. |

The comments-page exclusion is not free: adapters match on hostname, so **the
content script must stand down per-path**, which neither existing adapter does.
Cheapest shape: `findPosts()` returns `[]` on a comments URL, leaving
`SiteAdapter` untouched.

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
through `isActiveOn()`. That is a feature, not a config flag.

**If the answer is "keep it optional", that is its own spec.** Do not build it
inside this one.

## 4. DOM findings — verified

| Concern   | Selector                                                                                          |
| :-------- | :------------------------------------------------------------------------------------------------ |
| Container | `article[data-post-id]`                                                                           |
| Post gate | The `data-post-id` attribute itself — see below                                                   |
| Title     | `post-title` attribute on the child `<shreddit-post>`                                             |
| Body      | `shreddit-post-text-body` descendant, plain `textContent`                                         |
| Media     | `img[src*="preview.redd.it"], img[src*="i.redd.it"], img[src*="external-preview.redd.it"], video` |

**Everything is light DOM.** The three questions the plan called blockers:

1. **Is post content reachable from a content script?** Yes. Titles, bodies and
   media are all in the captured markup — nothing is behind a shadow root.
   `shreddit-post` is a custom element, but its content is slotted, not
   encapsulated.
2. **Does a `document`-level MutationObserver see new cards?** Not provable from
   a static capture, but the articles sit directly under `shreddit-feed` in the
   light DOM, so `FeedScanner`'s existing `documentElement` + `subtree: true`
   observer should see them. **Confirm on first live run** — cheap to check, and
   nothing else depends on the answer.
3. **What separates a post from an ad or a module?** `article[data-post-id]`,
   and it is airtight: all **4 ads** render as `<shreddit-ad-post>` **outside any
   `<article>`**, and the **6 recommendation carousel cards** are
   `<article slot="content">` with **no `data-post-id`**. The allowlist falls out
   of the markup instead of being reverse-engineered, as it was for X (`article`)
   and LinkedIn (an `<h2>` reading `Feed post`).

**Blur the `<article>`, not the `<shreddit-post>`.** The article carries the id
and bounds the card; the `<hr>` separators sit outside it, so they stay sharp —
the same reason X blurs the cell rather than the article.

**The title is an attribute, so there is no text node to clean.** No clone, no
"… more" toggle to strip — LinkedIn needed both. Body truncation is pure CSS
(`max-h-*` + `overflow-hidden`), so the full text is always in the DOM and a
plain `textContent` read gets it.

**Media splits cleanly by host**, the same asset-taxonomy trick that worked for
LinkedIn's `feedshare-image`. Post bodies resolve to `preview.redd.it`,
`i.redd.it`, `external-preview.redd.it` and `v.redd.it`; avatars, community
icons and awards resolve to `styles.redditmedia.com`, `emoji.redditmedia.com`
and `b.thumbs.redditmedia.com`. Nothing overlaps.

### 4.1 Reddit labels the language itself

`<shreddit-post>` carries **`post-language`**. Across the 25 captured posts:

| `en` | `es` | `ca` | `it` | `und` |
| ---: | ---: | ---: | ---: | ----: |
|   16 |    6 |    1 |    1 |     1 |

**9 of 25 posts are not in English** — the language gate matters more here than
on either existing site, and `und` maps exactly onto our `unclear`.

Tempting, and **not recommended for v4**: reading the attribute instead of
calling CLD. It is free and synchronous where CLD is a round trip, but it is
what Reddit believes rather than what we can verify, and taking it would give
Reddit a second detection path with different failure modes for no user-visible
gain. Use [LanguageCache](../src/feed/language-detector.ts) as-is; revisit only
if detection latency shows up in practice. **Do compare the two on the capture**
— a disagreement rate is a cheap sanity check on our own gate.

## 5. The real problem: a Reddit post barely has text

Counted from the capture, by `post-type`:

| Type                       | Count | Text available |
| :------------------------- | ----: | :------------- |
| `image`                    |     9 | Title only     |
| `text`                     |     8 | Title + body   |
| `gallery`, `video`, `link` |     6 | Title only     |
| `crosspost`, `multi_media` |     2 | Title only     |

**17 of 25 posts are a title and nothing else** — roughly 40–120 characters.

Two facts from [model.md](../wiki-llm/model.md) apply and pull in opposite
directions:

- **Reassuring:** _"Length does not shift e5."_ On-topic mean by length ran
  0.804 / 0.800 / 0.814 / 0.810 across 0–80 / 80–150 / 150–250 / 250+ chars.
  **The 0–80 bucket is exactly Reddit's median post**, and it did not sag.
- **Worrying:** the whole decision lives in a **0.035-wide strip**, measured on
  X-length prose. Nothing says a 60-character title separates as cleanly, and
  the measurement to settle it does not exist yet.

**And `MIN_BACKING_CHARS = 30` stops meaning what it meant.** On X it caught a
photo captioned "lol". Here every one of the 9 image posts clears 30 characters
of title while carrying all its meaning in the image, so `blurThinMedia` will
quietly stop firing on exactly the posts it was built for. Not a bug — but the
setting's hint becomes untrue on Reddit.

### 5.1 The subreddit is the strongest signal and it is not in the title

`r/programming` versus `r/politics` tells a filter more than any title in
either. `subreddit-name` sits right there on the element, so including it costs
one line — the question is only whether it helps.

| Option                                   | Cost                                                                                              |
| :--------------------------------------- | :------------------------------------------------------------------------------------------------ |
| 1. Prepend it: `"programming — <title>"` | One line. Shifts every score on the site.                                                         |
| 2. Title only                            | Loses the best signal.                                                                            |
| 3. New `Post` field, scored separately   | Changes the adapter contract and the engine. Out of scope unless §5.2 says it is worth that much. |

**Recommendation: option 1, bare name, no `r/` prefix** — `r/` is not a word and
e5 matches every token. Pending §5.2. Note that option 1 also makes
`alwaysKeep`/`alwaysBlur` work on sub names for free, since overrides are
substring matches over the post text.

For `text` posts, score **title + body** (the body is real prose and the queue
already caps at `MAX_CHARS`).

### 5.2 Measure before choosing

The harness in `.local/spikes/topic-viability/` already does this — `collect.js`
scrapes visible text, `label.html` labels it, `score.mjs` reports AUC. Point it
at `/r/all` and run the same comparison this repo ran for topic phrasing:

| Variant to score      | Answers                                   |
| :-------------------- | :---------------------------------------- |
| Title only            | Is a title enough? Baseline AUC.          |
| `"<sub> — <title>"`   | Does the subreddit help, and by how much? |
| `"r/<sub> — <title>"` | Does the `r/` prefix cost anything?       |
| Title + body          | Does body text help where it exists?      |

**~150 labelled posts is the bar**, matching the 205 the rest of model.md rests
on. Report AUC and the on/off-topic means. **If the means fall outside
`0.76 – 0.83`, Reddit needs its own band**, and `bandMin`/`bandMax` stop being a
single global default — a change to [settings.ts](../src/core/settings.ts), not
to the adapter. That is the one finding that could make this spec much larger.

## 6. Task order

0. §3 permission decision. **Blocks the manifest change.**
1. §5.2 measurement. **Blocks the text-extraction design**, and may add a band
   task.
2. `redditAdapter` in `src/adapters/reddit.ts` + `reddit.test.ts`, synthetic
   fixtures only — never the raw capture.
3. Register in `src/adapters/index.ts`; host into `wxt.config.ts` and
   `content.ts` `matches`.
4. Live check: scroll the feed and confirm `FeedScanner` sees appended cards
   (§4 Q2), and that node recycling behaves as the score cache already assumes.
5. Update `wiki-llm/adapters.md`, `manifest.md`, `index.md`, and `model.md` if
   §5.2 produced numbers — same commit.

## 7. Blockers and open questions

**Resolved by the capture:** shadow DOM (§4 Q1 — everything is light DOM, the
adapter is buildable) and post-vs-ad detection (§4 Q3 — `article[data-post-id]`
excludes all 4 ads and all 6 carousel cards by construction).

**Blockers** — work stops until answered:

- **B1. Permission model.** §3. Optional-host is a separate feature; the
  manifest change cannot be written until this is decided. Recommendation:
  promote to default.
- **B2. v3 is still marked IN PROGRESS.** `conventions.md` allows **at most one
  active plan** in `specs/`. The LinkedIn adapter has shipped and was exercised
  against a live feed, but only you can confirm it is verified. **v3 must be
  marked superseded before v4 becomes the active plan.** Related and already
  stale: `conventions.md` still names **v2** as the active plan, two versions
  behind. Whoever closes v3 should repoint it in the same commit.

**Open questions** — answer changes the design, not whether to start:

- **Q1. Is a 60-character title enough to score?** §5.2 baseline. If AUC comes
  back near chance, Reddit is not viable at any threshold and this spec should
  stop rather than ship a filter that blurs at random — the same conclusion the
  v1 spike was built to be able to reach.
- **Q2. Does the subreddit go into the text?** §5.1. Recommendation: yes, bare
  name, no `r/` — pending §5.2.
- **Q3. Does Reddit need its own threshold band?** §5.2. If the means fall
  outside `0.76 – 0.83`, the band stops being global and `Settings` grows a
  per-site shape. Sizeable; better known now than discovered mid-build.
- **Q4. What happens to `blurThinMedia` here?** §5. The 30-char rule barely
  fires on Reddit image posts. Options: leave it (the hint is then wrong for
  Reddit), raise the floor per-site, or treat an image post with only a title as
  thin regardless of length. No recommendation yet.
- **Q5. Trust `post-language` over CLD?** §4.1. Recommendation: no for v4, but
  compare the two on the capture — cheap, and it validates our own gate.
- **Q6. Should the comments page filter comments instead of standing down?**
  §2 says stand down. There is a real product question underneath — a 400-comment
  thread is a feed — but it is a different unit, a different reveal UX, and
  should not ride along here.
- **Q7. Does `old.reddit.com` ever get an adapter?** Recommendation: no. Noted
  so it is not rediscovered as an oversight.
