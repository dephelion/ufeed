import type { Post, SiteAdapter } from './types';

const CONTAINER = '[componentkey^="update-card-focus"]';
const TEXT = '[data-testid="expandable-text-box"]';
const TEXT_TOGGLE = '[data-testid="expandable-text-button"]';

/** Screen-reader-only heading every real post carries; distinguishes it from
 * job ads, polls, and other feed modules that share the same card shell. */
function isPost(container: HTMLElement): boolean {
  for (const h2 of container.querySelectorAll('h2')) {
    if (h2.textContent?.trim() === 'Feed post') return true;
  }
  return false;
}

export const linkedinAdapter: SiteAdapter = {
  id: 'linkedin',

  matches(hostname) {
    return hostname === 'linkedin.com' || hostname.endsWith('.linkedin.com');
  },

  containerSelector: CONTAINER,

  mediaSelector: 'img[src*="feedshare-image"], video',

  findPosts(root) {
    const containers = new Set<Element>();
    if (root instanceof Element && root.matches(CONTAINER)) containers.add(root);
    for (const el of root.querySelectorAll(CONTAINER)) containers.add(el);

    const posts: Post[] = [];
    for (const container of containers) {
      if (!(container instanceof HTMLElement)) continue;
      if (!isPost(container)) continue;
      posts.push({ container, text: extractText(container) });
    }
    return posts;
  },
};

/**
 * First expandable-text-box only. The same node type renders inline comment
 * bodies further down the card, so taking only the first keeps the post's own
 * text and drops any comment — same shape as X's first-tweetText rule, for an
 * unrelated reason.
 */
function extractText(container: HTMLElement): string {
  const node = container.querySelector(TEXT);
  if (!node) return '';
  const clone = node.cloneNode(true) as HTMLElement;
  clone.querySelector(TEXT_TOGGLE)?.remove();
  return clone.textContent?.replace(/\s+/g, ' ').trim() ?? '';
}
