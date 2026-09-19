import type { Post, SiteAdapter } from '../feed/ports';

const CONTAINER = 'article[data-post-id]';
const POST = 'shreddit-post';
const BODY = 'shreddit-post-text-body';

/**
 * A comment thread is not a feed — the reader opened it deliberately. A denylist,
 * not an allowlist: every other listing (home, r/<sub>, r/all, search, a
 * multireddit) shares the card shape and should filter.
 */
export function isFeedPath(pathname: string): boolean {
  return !pathname.includes('/comments/');
}

/**
 * Blurs the article, not the shreddit-post: the article bounds the card and the
 * separators sit outside it, so they stay sharp.
 */
export const redditAdapter: SiteAdapter = {
  id: 'reddit',

  matches(hostname) {
    // old.reddit.com is a different DOM entirely; not matching is the documented
    // answer rather than an oversight.
    if (hostname.startsWith('old.')) return false;
    return hostname === 'reddit.com' || hostname.endsWith('.reddit.com');
  },

  containerSelector: CONTAINER,

  mediaSelector:
    'img[src*="preview.redd.it"], img[src*="i.redd.it"], ' +
    'img[src*="external-preview.redd.it"], video',

  findPosts(root) {
    if (!isFeedPath(location.pathname)) return [];

    const containers = new Set<Element>();
    if (root instanceof Element && root.matches(CONTAINER)) containers.add(root);
    for (const el of root.querySelectorAll(CONTAINER)) containers.add(el);

    const posts: Post[] = [];
    for (const container of containers) {
      if (!(container instanceof HTMLElement)) continue;
      const post = container.querySelector(POST);
      if (!post) continue;
      posts.push({ container, text: extractText(container, post) });
    }
    return posts;
  },
};

/**
 * The title rides on an attribute, so there is nothing to clone and no "… more"
 * toggle to strip — both other adapters needed one. The body exists only on text
 * posts; every other type is a title and nothing else.
 */
function extractText(container: HTMLElement, post: Element): string {
  const title = post.getAttribute('post-title') ?? '';
  const body = container.querySelector(BODY)?.textContent ?? '';
  return `${title} ${body}`.replace(/\s+/g, ' ').trim();
}
