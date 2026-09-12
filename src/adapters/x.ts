import type { Post, SiteAdapter } from './types';

const CONTAINER = '[data-testid="cellInnerDiv"]';
const TEXT = '[data-testid="tweetText"]';
const POST = 'article';

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

  mediaSelector:
    '[data-testid="tweetPhoto"], [data-testid="videoPlayer"], ' +
    '[data-testid="videoComponent"], video',

  findPosts(root) {
    const containers = new Set<Element>();
    if (root instanceof Element && root.matches(CONTAINER)) containers.add(root);
    for (const el of root.querySelectorAll(CONTAINER)) containers.add(el);

    const posts: Post[] = [];
    for (const container of containers) {
      if (!(container instanceof HTMLElement)) continue;
      if (!container.querySelector(POST)) continue;
      posts.push({ container, text: extractText(container) });
    }
    return posts;
  },
};

/**
 * First tweetText only. A cell can hold a quoted tweet or a thread, and joining
 * them scores one blob of unrelated subjects. textContent, not innerText:
 * innerText forces a reflow on every post. Empty is a real answer: a caption-less
 * media post has no tweetText node at all.
 */
function extractText(container: HTMLElement): string {
  const node = container.querySelector(TEXT);
  return node?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
}
