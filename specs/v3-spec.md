# FeedLens v3 — LinkedIn Adapter

> **Status: DELIVERED, superseded.** Verified on a live LinkedIn feed on
> 2026-09-12. Kept for provenance.
>
> The two variants this document left as known gaps were never found in practice
> and never misbehaved; the allowlist design is what made them safe to leave
> open. Current adapter behaviour lives in
> [adapters.md](../wiki-llm/adapters.md).
>
> The source of truth is [`wiki-llm/`](../wiki-llm/index.md).

---

## 1. Problem

FeedLens works end to end on X only. This adds LinkedIn's main feed as a second
`SiteAdapter` ([types.ts](../src/adapters/types.ts)) — no changes to scoring,
UI, or storage, since those are already site-agnostic.

## 2. Permissions

`linkedin.com` joins `FEED_HOSTS` in `wxt.config.ts` as a **default**
`host_permissions` entry, same as x.com/twitter.com — not optional-on-request
like the unused Reddit slot. Decided explicitly: a user installing FeedLens
already wants it running on the social sites they use, so there is no value in
an extra runtime permission prompt per site.

## 3. DOM findings

LinkedIn's feed classes are atomic/hashed (`_62ae7714`, `bde1bb6e`, …),
regenerated per build — unusable as selectors, and a worse case of the
vendor-drift risk `adapters.md` already flags for X. Every selector below
anchors on semantic attributes instead: ARIA, `data-testid`, `componentkey`.

| Concern   | Selector                                                                                              |
| :-------- | :---------------------------------------------------------------------------------------------------- |
| Container | `[componentkey^="update-card-focus"]`                                                                 |
| Post gate | An `<h2>` descendant whose text is exactly `Feed post`                                                |
| Text      | First `[data-testid="expandable-text-box"]`, minus its `[data-testid="expandable-text-button"]` child |
| Media     | `img[src*="feedshare-image"]`, `video`                                                                |

**Container.** `componentkey^="update-card-focus"` held identically across all
three captures regardless of content (plain post, "X commented" banner, "X
reposted this" banner) — a stable anchor, unlike any class on the element.

**Post gate, mirrors X's `article` check.** Every real post carries a
visually-hidden `<h2><span>Feed post</span></h2>` for screen readers. Like X's
`article`-required rule, this is an **allowlist**: a card is scored only if
the label is present, so an unrecognized module type is excluded by
construction, not because it was tested against. This is what lets the two
unfound variants (below) stay unblocking.

**Text extraction has a trap the X adapter doesn't.** `expandable-text-box` is
reused for **comment bodies too** — LinkedIn auto-renders at least one comment
inline under the post. A card with an inline comment has two
`expandable-text-box` nodes; taking the first one only is what keeps the post's
own text and discards the comment, same _shape_ of rule as X's "first
`tweetText` only" (adapters.md), for an unrelated reason (nested comment, not a
nested quote).

**The "…more" truncation button is nested inside the text node.** Truncated
posts render the full text in the DOM already (no lazy-load), but
`[data-testid="expandable-text-button"]` (the "… more" toggle) sits inside
`expandable-text-box`, so a raw `textContent` read appends "… more" to the
end. Extraction must clone the node and remove that button first.

**Media distinguishes by asset-type naming, not by size or wrapper.** Avatar
images resolve to `profile-displayphoto-*` on `media.licdn.com`; post-body
images resolve to `feedshare-image-*`. Matching on that URL segment is more
durable than any class or dimension check, since it reflects LinkedIn's own
CDN taxonomy. No video post was captured — `video` is included defensively
(same as X's media selector), unconfirmed against a real one.

## 4. Known gaps

Not scheduled, documented so they are not rediscovered:

- **Quote-repost with the resharer's own added commentary was not found.**
  The one repost captured was a bare reshare (no added text), structurally
  identical to the "X commented"/"X reacted" banner cases. If a resharer's
  own comment turns out to render as a **third** `expandable-text-box` before
  the embedded original, "first box only" should still pick the resharer's
  words — X's precedent (adapters.md: "discards quoted-tweet text") says that
  is the right failure mode if a nested case exists that this rule handles
  imperfectly. Revisit with a real sample if this misscores in practice.
- **No non-post module was captured.** The allowlist design (§3 Post gate)
  means this is a fail-open gap, not a fail-blur one: an unrecognized card is
  never scored, so it is never wrongly blurred — it just isn't filtered
  either, until a sample shows what its heading says.
- **Virtualization / node recycling on scroll is unverified.** X recycles DOM
  nodes on scroll, which is why its score cache keys on a text hash rather
  than the node (adapters.md). The existing `FeedScanner` + `ScoreCache`
  design already assumes this defensively regardless of the answer, so it
  does not block shipping — worth confirming later by scrolling and checking
  in devtools whether an already-scored card keeps its node.

## 5. Task order

1. `linkedinAdapter` in `src/adapters/linkedin.ts` + fixture tests
   (`linkedin.test.ts`), synthetic HTML only — never the raw captures in
   `.local/linkedin/`, which stay gitignored and unsanitized.
2. Register it in `src/adapters/index.ts`.
3. Wire the host into `wxt.config.ts` (`FEED_HOSTS`) and
   `src/entrypoints/content.ts` (`matches`).
4. Update `wiki-llm/adapters.md`, `wiki-llm/manifest.md`, `wiki-llm/index.md`
   in the same commit.

Delivered and verified; superseded like [`v1-spec.md`](v1-spec.md) and
[`v2-spec.md`](v2-spec.md), and kept for provenance only.
