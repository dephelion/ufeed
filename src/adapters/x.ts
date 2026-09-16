import type { Post, SiteAdapter } from './types';

const CONTAINER = '[data-testid="cellInnerDiv"]';
const TEXT = '[data-testid="tweetText"]';
const POST = 'article';
const AVATAR = '[data-testid="Tweet-User-Avatar"]';
const FOCAL = 'article[tabindex="-1"]';
const HEADING = '[role="heading"]';

function isStatusPath(pathname: string): boolean {
  return /^\/[^/]+\/status\/\d+/.test(pathname);
}

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

  containerSelector: CONTAINER,

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
      const anchor = anchorOf(container);
      posts.push({ container, text: extractText(container), ...(anchor && { anchor }) });
    }
    return posts;
  },
};

/**
 * Every tweetText node, joined: a quote tweet's own comment is often a few
 * throwaway words ("12 years ago") with the whole subject living in the quoted
 * tweet beneath it, so scoring the outer text alone judges the wrong thing.
 * DOM order puts the outer comment first and the quote after, which reads the
 * same way a person does. textContent, not innerText: innerText forces a
 * reflow on every post. Empty is a real answer: a caption-less media post has
 * no tweetText node at all.
 */
function extractText(container: HTMLElement): string {
  const nodes = container.querySelectorAll(TEXT);
  return [...nodes]
    .map((node) => node.textContent ?? '')
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** A reply follows the opened post on a status page, else the root of its drawn thread. */
function anchorOf(cell: HTMLElement): HTMLElement | undefined {
  if (!isStatusPath(location.pathname)) return chainRoot(cell);
  const focal = cell.ownerDocument.querySelector(FOCAL)?.closest<HTMLElement>(CONTAINER);
  if (!focal || focal.parentElement !== cell.parentElement) return chainRoot(cell);
  if (focal === cell) return undefined;
  if (cell.compareDocumentPosition(focal) & Node.DOCUMENT_POSITION_FOLLOWING)
    return focal;
  for (let el = focal.nextElementSibling; el && el !== cell; el = el.nextElementSibling) {
    if (el.querySelector(HEADING)) return chainRoot(cell);
  }
  return focal;
}

function chainRoot(cell: HTMLElement): HTMLElement | undefined {
  let root: HTMLElement | undefined;
  let current = cell;
  while (lines(current).up) {
    const previous = current.previousElementSibling;
    if (!(previous instanceof HTMLElement) || !previous.matches(CONTAINER)) break;
    if (!lines(previous).down) break;
    root = current = previous;
  }
  return root;
}

/**
 * The connector X draws between avatars is an extra, empty child: under the
 * avatar for a parent, in the row above it for a reply. Classes are hashed.
 */
function lines(cell: HTMLElement): { up: boolean; down: boolean } {
  const column = cell.querySelector(`${POST} ${AVATAR}`)?.parentElement;
  const above = column?.parentElement?.previousElementSibling?.firstElementChild;
  return {
    up: (above?.childElementCount ?? 0) > 1,
    down: (column?.childElementCount ?? 0) > 1,
  };
}
