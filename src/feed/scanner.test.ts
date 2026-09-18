import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Post } from '../adapters';
import { xAdapter } from '../adapters/x';
import { FeedScanner } from './scanner';

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

  it('leaves a finished post alone when the host re-renders inside it', async () => {
    document.body.innerHTML = cell('<div data-testid="tweetText">Some text</div>');
    await flush();
    document.getElementById('body')!.insertAdjacentHTML('beforeend', '<span>6.3K</span>');
    await flush();
    expect(offered).toHaveLength(1);
  });
});
