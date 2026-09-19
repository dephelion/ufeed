# FeedLens v4 — Reddit Adapter

> **Status: DELIVERED, superseded.** Built and verified on a live Reddit feed on
> 2026-09-12. Kept for provenance: it records the blockers that turned out not to
> be blockers, and the measurements that overturned two of its own
> recommendations.
>
> **Both DOM blockers were wrong.** Shadow DOM is a non-issue — `shreddit-post`
> content is slotted, so it is light DOM — and the ad/module gate fell out of the
> markup as `article[data-post-id]`.
>
> **Two of its recommendations were overturned by measurement.** §5.1 recommended
> prepending the subreddit; measured, that compressed the score spread from 0.111
> to 0.087 and lifted the wrong posts hardest, so the adapter leaves it out. And
> §5.2's fear that Reddit would need its own threshold band did not materialise —
> the score distribution sits where X's does.
>
> **Do not consult this document for current behaviour.** Its threshold
> discussion predates the 0-10 strictness scale that replaced the band entirely.
> Current behaviour lives in [adapters.md](../wiki-llm/adapters.md) and
> [model.md](../wiki-llm/model.md).
>
> The source of truth is [`wiki-llm/`](../wiki-llm/index.md).

---

## 1. Problem

FeedLens filters X and LinkedIn. Reddit is the third feed, and the first where
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

## 3. Permissions — decided

`reddit.com` already sits in `OPTIONAL_HOSTS` in
[wxt.config.ts](../wxt.config.ts#L9), unused. v3 §2 faced the same fork for
LinkedIn and chose the default list, reasoning that _"a user installing FeedLens
already wants it running on the social sites they use, so there is no value in
an extra runtime permission prompt per site."_

**Decided: Reddit is a default host, exactly like X and LinkedIn.** Move it into
`FEED_HOSTS` and delete `OPTIONAL_HOSTS` and its `web_accessible_resources`
entry — nothing else uses the optional list, so the concept leaves the codebase
with it. No runtime prompt, no request button, no second code path through
`isActiveOn()`.

**Make the change with the adapter, not before it.** A manifest that asks for
`reddit.com` while nothing filters Reddit is a permission prompt with no feature
behind it — worse in store review than asking later, and invisible to test
against. It belongs in the same commit as step 2 of §6.

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

1. §5.2 measurement. **Blocks the text-extraction design**, and may add a band
   task.
2. `redditAdapter` in `src/adapters/reddit.ts` + `reddit.test.ts`, synthetic
   fixtures only — never the raw capture.
3. Register in `src/adapters/index.ts`; Reddit into `FEED_HOSTS` in
   `wxt.config.ts` (deleting `OPTIONAL_HOSTS`) and into `content.ts` `matches`,
   same commit as step 2 — see §3.
4. Live check: scroll the feed and confirm `FeedScanner` sees appended cards
   (§4 Q2), and that node recycling behaves as the score cache already assumes.
5. Update `wiki-llm/adapters.md`, `manifest.md`, `index.md`, and `model.md` if
   §5.2 produced numbers — same commit.

## 7. Blockers and open questions — closed

All resolved. Recorded as delivered, with the two survivors carried into the
wiki rather than left here.

| Item                               | Outcome                                                                                                                                     |
| :--------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------ |
| Shadow DOM                         | **Not a blocker.** All light DOM. [adapters.md](../wiki-llm/adapters.md)                                                                    |
| Post vs ad detection               | **Not a blocker.** `article[data-post-id]` excludes ads and carousels by construction.                                                      |
| B1 permission model                | **Default host**, like X and LinkedIn. `optional_host_permissions` deleted.                                                                 |
| B2 v3 still open                   | **Closed.** v3 marked superseded.                                                                                                           |
| Q1 is a title enough to score?     | **Yes.** Real tech posts score 0.834-0.858 against a 0.790 default cut; the top of a scored feed is genuinely on topic.                     |
| Q2 subreddit in the text?          | **No** — the opposite of this document's recommendation. Measured: spread 0.111 → 0.087, `r/fitness30plus` +0.066 against a software topic. |
| Q3 own threshold band?             | **No.** Reddit's distribution sits where X's does. The band was replaced by the 0-10 scale regardless.                                      |
| Q4 `blurThinMedia` on Reddit       | **Still open**, carried to [ui.md](../wiki-llm/ui.md). The 30-char rule rarely fires on Reddit image posts.                                 |
| Q5 trust `post-language` over CLD? | **No.** CLD everywhere; Reddit does not get a second detection path.                                                                        |
| Q6 filter comment pages?           | **No.** `isFeedPath()` stands down on `/comments/`.                                                                                         |
| Q7 `old.reddit.com` adapter?       | **No**, deliberately not matched.                                                                                                           |

**Never captured: a poll card.** The allowlist makes this safe — an unrecognised
card is simply not scored, so it is never wrongly blurred. Carried to
[adapters.md](../wiki-llm/adapters.md).
