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
}
```

`container` receives the blur class. `text` is what gets scored. `adapterFor(hostname)` picks one; no adapter means the content script stands down.

`findPosts` MUST check `root.matches(sel)` as well as `root.querySelectorAll(sel)` — a mutation can add a node that **is** a post, and `querySelectorAll` alone misses it. Dedupe through a `Set`; both paths can hit the same element.

## X

| Concern   | Selector                                               |
| :-------- | :----------------------------------------------------- |
| Container | `[data-testid="cellInnerDiv"]`                         |
| Post      | `article`                                              |
| Text      | `[data-testid="tweetText"]`                            |
| Media     | `tweetPhoto`, `videoPlayer`, `videoComponent`, `video` |

**Not `article`.** It leaves separators and padding sharp.

**First `tweetText` only.** A cell can hold a quoted tweet or a thread; joining them scores one blob of unrelated subjects, and a political post carrying a quoted tech tweet reads as tech.

**`textContent`, not `innerText`.** `innerText` forces a layout reflow per post, which a scrolling feed cannot afford. Whitespace is collapsed, so a re-render hashes identically.

**`article` is the post signal, not text.** A caption-less media post has NO `tweetText` node — identical to a follow or trend module. Requiring `article` keeps the media post and drops the module. Promoted tweets are real articles: they get scored like any post.

**No length floor.** Every post reaches the engine. The old 30-char drop was a MiniLM-era workaround; e5 does not shift with length ([model.md](model.md)), and a dropped post could never be blurred by any rule.

**Empty text never reaches the engine.** An embedding of nothing is not a score. Empty means unscorable, which reveals unless the media rule claims it ([ui.md](ui.md)).

**Media selector excludes avatars.** `[data-testid="Tweet-User-Avatar"]` is on every post; matching it would make every post a media post.

**The feed is virtualized.** Nodes are recycled with new content, so a `data-checked` flag on the node produces stale verdicts. The score cache is keyed on a hash of the **text** (`hashText`, FNV-1a over whitespace-collapsed lowercase), never on the node.

**Never a generic selector.** Bare `p` matched navigation, sidebars, our own UI, and text inside already-claimed posts.

## Reddit — not built

New Reddit renders `shreddit-post` as web components. `querySelectorAll` does not pierce shadow roots and a `<style>` in `document.head` does not apply inside them, so a naive adapter silently matches nothing. Needs recursive shadow-root traversal plus per-root `adoptedStyleSheets`. Host permission is already declared optional in [manifest.md](manifest.md).

## Vendor drift

Selectors are the most brittle surface in the project and vendors ship changes without notice. Failure mode is silence: zero matches looks identical to an empty feed.

Adapters are tested against **captured fixture HTML**, never a live fetch — see [testing.md](testing.md). A vendor change must fail as a red test, not as a no-op in production.
