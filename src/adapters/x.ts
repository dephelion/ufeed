import type { Post, SiteAdapter } from './types';

const CONTAINER = '[data-testid="cellInnerDiv"]';
const TEXT = '[data-testid="tweetText"]';
const MIN_CHARS = 30;

/** Blurs the cell, not the article: the article leaves separators and padding sharp. */
export const xAdapter: SiteAdapter = {
  id: 'x',

  matches(hostname) {
    return (
      hostname === 'x.com' ||
      hostname === 'twitter.com' ||
      hostname.endsWith('.x.com') ||
      hostname.endsWith('.twitter.com')
    );
  },

  findPosts(root) {
    const containers = new Set<Element>();
    if (root instanceof Element && root.matches(CONTAINER)) containers.add(root);
    for (const el of root.querySelectorAll(CONTAINER)) containers.add(el);

    const posts: Post[] = [];
    for (const container of containers) {
      if (!(container instanceof HTMLElement)) continue;
      const text = extractText(container);
      if (text.length >= MIN_CHARS) posts.push({ container, text });
    }
    return posts;
  },
};

/**
 * First tweetText only. A cell can hold a quoted tweet or a thread, and joining
 * them scores one blob of unrelated subjects. textContent, not innerText:
 * innerText forces a reflow on every post.
 */
function extractText(container: HTMLElement): string {
  const node = container.querySelector(TEXT);
  return node?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
}
