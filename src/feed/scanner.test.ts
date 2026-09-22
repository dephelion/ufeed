import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Post } from './ports';
import { xAdapter } from '../adapters/x';
import { FeedScanner, hasMedia } from './scanner';

/** happy-dom never intersects; this one reports every observed node as in view. */
class InView {
  constructor(private readonly callback: IntersectionObserverCallback) {}
  observe(target: Element): void {
    const entry = { target, isIntersecting: true } as IntersectionObserverEntry;
    this.callback([entry], this as unknown as IntersectionObserver);
  }
  unobserve(): void {}
  disconnect(): void {}
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

const cell = (inner: string) =>
  `<div data-testid="cellInnerDiv"><article><div id="body">${inner}</div></article></div>`;

describe('FeedScanner', () => {
  let offered: Post[];
  let scanner: FeedScanner;

  beforeEach(() => {
    vi.stubGlobal('IntersectionObserver', InView);
    document.body.innerHTML = '';
    offered = [];
    scanner = new FeedScanner({
      adapter: xAdapter,
      isActive: () => true,
      onEnterView: (post) => offered.push(post),
    });
    scanner.start();
  });

  afterEach(() => {
    scanner.stop();
    vi.unstubAllGlobals();
  });

  it('announces a post when it is found, ahead of it entering view', () => {
    const events: string[] = [];
    const own = new FeedScanner({
      adapter: xAdapter,
      isActive: () => true,
      onFound: () => events.push('found'),
      onEnterView: () => events.push('view'),
    });
    document.body.innerHTML = cell('x');
    own.sweep(document);
    own.stop();
    expect(events).toEqual(['found', 'view']);
  });

  it('offers a post again when its photo mounts after it was judged', async () => {
    document.body.innerHTML = cell('');
    await flush();
    expect(offered).toHaveLength(1);
    document
      .getElementById('body')!
      .insertAdjacentHTML('beforeend', '<div data-testid="tweetPhoto"><img></div>');
    await flush();
    expect(offered).toHaveLength(2);
  });

  it('offers a post again when its text mounts after it was judged', async () => {
    document.body.innerHTML = cell('');
    await flush();
    document
      .getElementById('body')!
      .insertAdjacentHTML('beforeend', '<div data-testid="tweetText">Late text</div>');
    await flush();
    expect(offered.map((p) => p.text)).toEqual(['', 'Late text']);
  });

  it('offers a post again when the host swaps its text after it was judged', async () => {
    document.body.innerHTML = cell(
      '<div data-testid="tweetText"><span>First</span></div>',
    );
    await flush();
    document
      .querySelector('[data-testid="tweetText"] span')!
      .replaceWith(
        Object.assign(document.createElement('span'), { textContent: 'Swapped' }),
      );
    await flush();
    expect(offered.map((p) => p.text)).toEqual(['First', 'Swapped']);
  });

  it('leaves a finished post alone when the host re-renders inside it', async () => {
    document.body.innerHTML = cell('<div data-testid="tweetText">Some text</div>');
    await flush();
    document.getElementById('body')!.insertAdjacentHTML('beforeend', '<span>6.3K</span>');
    await flush();
    expect(offered).toHaveLength(1);
  });
});

const mountMedia = (html: string) => {
  document.body.innerHTML = `<div id="c">${html}</div>`;
  return document.getElementById('c') as HTMLElement;
};

describe('hasMedia', () => {
  it('sees a photo', () => {
    expect(hasMedia(mountMedia('<div data-testid="tweetPhoto"></div>'), xAdapter)).toBe(
      true,
    );
  });

  it('sees a video', () => {
    expect(hasMedia(mountMedia('<video></video>'), xAdapter)).toBe(true);
  });

  it('ignores an avatar, or every post would count as media', () => {
    const el = mountMedia(
      '<div data-testid="Tweet-User-Avatar"><img src="a.jpg" /></div>',
    );
    expect(hasMedia(el, xAdapter)).toBe(false);
  });
});
