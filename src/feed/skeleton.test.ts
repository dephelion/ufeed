import { beforeEach, describe, expect, it, vi } from 'vitest';
import { hideAllSkeletons, hideSkeleton, isSkeleton, showSkeleton } from './skeleton';

const post = () => {
  document.body.innerHTML = '<div id="p"><span>text</span></div>';
  return document.getElementById('p') as HTMLElement;
};

describe('the skeleton', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('holds a post while it is being judged, without claiming a verdict', () => {
    const el = post();
    showSkeleton(el);
    expect(isSkeleton(el)).toBe(true);
    // A verdict is a blur: a label, a reason, and hidden from a screen reader.
    expect(el.hasAttribute('aria-hidden')).toBe(false);
    expect(el.dataset.lxReason).toBeUndefined();
    expect(el.classList.contains('lx-blur')).toBe(false);
  });

  it('lifts again on demand', () => {
    const el = post();
    showSkeleton(el);
    hideSkeleton(el);
    expect(isSkeleton(el)).toBe(false);
  });

  it('is safe to lift on a post that was never held', () => {
    const el = post();
    expect(() => hideSkeleton(el)).not.toThrow();
  });

  it('lifts every held post, so nothing is left loading forever', () => {
    document.body.innerHTML = '<div id="a"></div><div id="b"></div>';
    const a = document.getElementById('a') as HTMLElement;
    const b = document.getElementById('b') as HTMLElement;
    showSkeleton(a);
    showSkeleton(b);

    hideAllSkeletons(document);

    expect(isSkeleton(a)).toBe(false);
    expect(isSkeleton(b)).toBe(false);
  });
});

describe('the failsafe timer', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    vi.useFakeTimers();
  });

  it('lifts a post nothing ever answered for', () => {
    const el = post();
    showSkeleton(el);
    vi.advanceTimersByTime(10_000);
    expect(isSkeleton(el)).toBe(false);
  });

  it('extends rather than stacking, so re-holding cannot be cut short', () => {
    const el = post();
    showSkeleton(el);
    vi.advanceTimersByTime(9_000);

    // Re-held while the queue is still draining: the first timer must not fire.
    showSkeleton(el);
    vi.advanceTimersByTime(2_000);
    expect(isSkeleton(el)).toBe(true);

    vi.advanceTimersByTime(8_000);
    expect(isSkeleton(el)).toBe(false);
  });

  it('stops counting once the post is lifted', () => {
    const el = post();
    showSkeleton(el);
    hideSkeleton(el);
    showSkeleton(el);
    vi.advanceTimersByTime(9_000);
    // The lifted timer would have fired by now had it survived.
    expect(isSkeleton(el)).toBe(true);
    vi.useRealTimers();
  });
});
