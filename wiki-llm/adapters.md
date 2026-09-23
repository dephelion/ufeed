# Site Adapters

> **Maintenance Invariant:** Per-site DOM knowledge only. Selectors, extraction rules, vendor quirks. No scoring ([model.md](model.md)), no styling ([ui.md](ui.md)). Update in the SAME commit as any selector change. Token-optimized: imperative, no prose, no redundancy.
> **Answers:** How a post is found in a vendor DOM. X selectors and quirks. What breaks on a vendor change, and how it surfaces.

## Contract

```ts
interface SiteAdapter {
  id: string;
  matches(hostname: string): boolean;
  findPosts(root: ParentNode): Post[]; // { container, text }
  mediaSelector: string; // post-body media, never avatars
  leadPost?(container: HTMLElement): HTMLElement | undefined; // sites with inline replies only
}
```

`container` receives the blur class. `text` is what gets scored. `leadPost` returns the container of the post a reply's conversation hangs from. Thread markup is per vendor, so the rule lives here; what a conversation does with it does not ([architecture.md](architecture.md) §Conversations). `adapterFor(hostname)` picks one; no adapter means the content script stands down.

`findPosts` MUST check `root.matches(sel)` as well as `root.querySelectorAll(sel)` — a mutation can add a node that **is** a post, and `querySelectorAll` alone misses it. Dedupe through a `Set`; both paths can hit the same element.

## X

| Concern   | Selector                                               |
| :-------- | :----------------------------------------------------- |
| Container | `[data-testid="cellInnerDiv"]`                         |
| Post      | `article`                                              |
| Text      | `[data-testid="tweetText"]`                            |
| Media     | `tweetPhoto`, `videoPlayer`, `videoComponent`, `video` |

**Not `article`.** It leaves separators and padding sharp.

**All `tweetText` nodes, joined in DOM order.** A quote's outer comment may be too short to name its subject; include the quoted text so it can carry that subject. The quote can also make an otherwise off-topic comment score as relevant.

**`textContent`, not `innerText`.** `innerText` forces a layout reflow per post, which a scrolling feed cannot afford. Whitespace is collapsed, so a re-render hashes identically.

**`article` is the post signal, not text.** A caption-less media post has NO `tweetText` node — identical to a follow or trend module. Requiring `article` keeps the media post and drops the module. Promoted tweets are real articles: they get scored like any post.

**No length floor.** Every post reaches the engine. The old 30-char drop was a MiniLM-era workaround; e5 does not shift with length ([model.md](model.md)), and a dropped post could never be blurred by any rule.

**Empty text never reaches the engine.** An embedding of nothing is not a score. Empty means unscorable, which reveals unless the media rule claims it ([ui.md](ui.md)).

**Media selector excludes avatars.** `[data-testid="Tweet-User-Avatar"]` is on every post; matching it would make every post a media post.

**The feed is virtualized.** Nodes are recycled with new content, so a `data-checked` flag on the node produces stale verdicts. The score cache is keyed on a hash of the **text** (`hashText`, FNV-1a over whitespace-collapsed lowercase), never on the node.

### Lead post (`leadPost`)

| Concern       | Signal                                                          |
| :------------ | :-------------------------------------------------------------- |
| Opened post   | `article[tabindex="-1"]` on a `/<user>/status/<id>` path        |
| Section break | A cell holding `[role="heading"]` ("Discover more", any locale) |
| Line down     | Parent of `Tweet-User-Avatar` has more than one child           |
| Line up       | Row above the avatar row wraps a row with more than one child   |

**Status page:** every cell before the opened post, and after it up to the first heading cell, has the opened post as lead post. The opened post leads itself, so it is never filtered ([architecture.md](architecture.md) §Conversations). Cells past the heading are recommendations: chain rule only.

**Any page:** a cell with a line up has as lead post the first cell of its unbroken chain of line-down neighbours. Home shows parent + reply this way.

**Structure, not classes.** The connector is an empty div with hashed classes. Verified on a home and a status capture: every drawn pair matched, no unconnected post matched.

**Chain needs both cells rendered.** A parent recycled out of the DOM leaves the reply judged alone — today's behaviour, fail-safe.

**Never a generic selector.** Bare `p` matched navigation, sidebars, our own UI, and text inside already-claimed posts.

## LinkedIn

| Concern   | Selector                                                                                              |
| :-------- | :---------------------------------------------------------------------------------------------------- |
| Container | `[componentkey^="update-card-focus"]`                                                                 |
| Post gate | An `<h2>` descendant with text exactly `Feed post`                                                    |
| Text      | First `[data-testid="expandable-text-box"]`, minus its `[data-testid="expandable-text-button"]` child |
| Media     | `img[src*="feedshare-image"]`, `video`                                                                |

**Classes are atomic/hashed and unusable.** Every class regenerates per build
(`_62ae7714`, `bde1bb6e`, …). Selectors anchor on ARIA, `data-testid`, and
`componentkey` instead — none of them a styling class.

**Post gate mirrors X's `article` check, for module exclusion.** A
screen-reader-only `<h2>Feed post</h2>` is present on every real post; a card
without it (job ad, poll, suggested-for-you) is never scored. Allowlist, not a
blocklist: an unrecognized module type is excluded by construction.

**`expandable-text-box` is reused for comment bodies, not just post text.**
LinkedIn renders at least one comment inline under the post by default.
Taking the **first** `expandable-text-box` in a container keeps the post's own
text and discards the comment.

**The "…more" toggle button is nested inside the text node.** Truncated posts
already carry their full text in the DOM (no lazy-load), but
`[data-testid="expandable-text-button"]` sits inside the text node itself, so
a raw `textContent` read appends "… more". Extraction clones the node and
removes that button before reading it.

**Media matches by CDN asset-type naming, not size or wrapper.** Avatars
resolve to `profile-displayphoto-*`; post-body images resolve to
`feedshare-image-*`, both on `media.licdn.com`. More durable than any class.

**Not seen live, documented as gaps:** a
quote-repost carrying the resharer's own added commentary (only a bare
reshare was captured); any non-post module's heading text; whether the feed
recycles DOM nodes on scroll the way X's does.

## Reddit

| Concern   | Selector                                                                                                |
| :-------- | :------------------------------------------------------------------------------------------------------ |
| Container | `article[data-post-id]`                                                                                 |
| Post gate | `data-post-id` plus a `shreddit-post` child                                                             |
| Title     | `post-title` attribute on that child                                                                    |
| Body      | `shreddit-post-text-body` descendant, plain `textContent`                                               |
| Media     | `img[src*="preview.redd.it"]`, `img[src*="i.redd.it"]`, `img[src*="external-preview.redd.it"]`, `video` |

**Shadow DOM was the expected blocker and is not one.** This page previously said a naive adapter would match nothing and would need recursive shadow-root traversal plus per-root `adoptedStyleSheets`. Measured against a real logged-in capture: **`shreddit-post` is a custom element, but its content is slotted, so it is all light DOM.** Titles, bodies and media are reachable by ordinary `querySelectorAll`, and `blur.css` applies normally. No traversal, no per-root stylesheets.

**The ad and module gate falls out of the markup**, where X's and LinkedIn's had to be reverse-engineered. In a 25-post capture: all **4 ads** render as `<shreddit-ad-post>` **outside any `<article>`**, and the **6 recommendation carousel cards** are `<article slot="content">` with **no `data-post-id`**. Requiring `data-post-id` excludes both by construction.

**Blur the `<article>`, not the `<shreddit-post>`.** The article bounds the card and the `<hr>` separators sit outside it, so they stay sharp — the same lesson as X's cell-not-article rule.

**The title is an attribute, so there is no node to clean.** No clone, no "… more" toggle to strip; LinkedIn needs both. Body truncation is CSS (`max-h-*` + `overflow-hidden`), so the full text is always in the DOM.

**Media splits by host, not by wrapper or size.** Post bodies resolve to `preview.redd.it`, `i.redd.it`, `external-preview.redd.it`, `v.redd.it`; avatars, community icons and awards resolve to `styles.redditmedia.com`, `emoji.redditmedia.com`, `b.thumbs.redditmedia.com`. Nothing overlaps — the same asset-taxonomy trick as LinkedIn's `feedshare-image`.

**It stands down on comment threads.** `isFeedPath()` rejects any path containing `/comments/`; every other listing (home, `r/<sub>`, `r/all`, search, a multireddit) shares the card shape and filters. A thread the reader opened deliberately is not a feed. This is the only adapter that reads the path, and it does so in `findPosts()` so `SiteAdapter` stays as it is.

**`old.reddit.com` is not matched**, deliberately — a different DOM entirely, and failing to match is the documented answer rather than an oversight.

**A poll card was never captured**, and that is safe rather than unfinished: the `data-post-id` allowlist means an unrecognised card is not scored, so it is never wrongly blurred — it simply is not filtered either.

**Reddit also labels the post's language** (`post-language` on `shreddit-post`). Not used: the language gate calls CLD like every other site, so Reddit does not get a second detection path with its own failure modes. See [model.md](model.md).

**Text is the title plus the body, and the subreddit is deliberately left out.** Measured on the capture, prepending the subreddit compressed the score spread from 0.111 to 0.087 and lifted the wrong posts most — `r/fitness30plus` gained 0.066 against a software topic. Sub names are not words, so e5 matches them weakly against everything. See [model.md](model.md).

## Vendor drift

Selectors are the most brittle surface in the project and vendors ship changes without notice. Failure mode is silence: zero matches looks identical to an empty feed.

Adapters are tested against **captured fixture HTML**, never a live fetch — see [testing.md](testing.md). A vendor change must fail as a red test, not as a no-op in production.
