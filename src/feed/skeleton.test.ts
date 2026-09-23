import { beforeEach, describe, expect, it, vi } from 'vitest';
import { hideAllSkeletons, hideSkeleton, isSkeleton, showSkeleton } from './skeleton';
import { translate as t } from '../platform/i18n';

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
    showSkeleton(el, t);
    expect(isSkeleton(el)).toBe(true);
    // A verdict is a blur: a label, a reason, and hidden from a screen reader.
    expect(el.hasAttribute('aria-hidden')).toBe(false);
    expect(el.dataset.lxReason).toBeUndefined();
    expect(el.classList.contains('lx-blur')).toBe(false);
  });

  it('carries the text the stylesheet draws, only while held', () => {
    const el = post();
    showSkeleton(el, t);
    expect(el.dataset.lxPending).toBe(t('labelPending'));
    hideSkeleton(el);
    expect(el.dataset.lxPending).toBeUndefined();
  });

  it('lifts again on demand', () => {
    const el = post();
    showSkeleton(el, t);
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
    showSkeleton(a, t);
    showSkeleton(b, t);

    hideAllSkeletons(document);

    expect(isSkeleton(a)).toBe(false);
    expect(isSkeleton(b)).toBe(false);
  });
});

describe('the lift', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('marks a post the verdict let through, so it fades in rather than flashing', () => {
    const el = post();
    showSkeleton(el, t);
    hideSkeleton(el, true);
    expect(el.classList.contains('lx-unveil')).toBe(true);
    expect(isSkeleton(el)).toBe(false);
  });

  it('leaves a post on its way to a blur alone: the blur is what it wears next', () => {
    const el = post();
    showSkeleton(el, t);
    hideSkeleton(el);
    expect(el.classList.contains('lx-unveil')).toBe(false);
  });

  it('drops the mark when a post is held again, so the next lift animates too', () => {
    const el = post();
    showSkeleton(el, t);
    hideSkeleton(el, true);
    showSkeleton(el, t);
    expect(el.classList.contains('lx-unveil')).toBe(false);
  });

  it('lifts the whole feed out of a hold when the failsafe clears it', () => {
    const el = post();
    showSkeleton(el, t);
    hideAllSkeletons();
    expect(el.classList.contains('lx-unveil')).toBe(true);
  });
});

describe('the failsafe timer', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    vi.useFakeTimers();
  });

  it('lifts a post nothing ever answered for', () => {
    const el = post();
    showSkeleton(el, t);
    vi.advanceTimersByTime(10_000);
    expect(isSkeleton(el)).toBe(false);
  });

  it('extends rather than stacking, so re-holding cannot be cut short', () => {
    const el = post();
    showSkeleton(el, t);
    vi.advanceTimersByTime(9_000);

    // Re-held while the queue is still draining: the first timer must not fire.
    showSkeleton(el, t);
    vi.advanceTimersByTime(2_000);
    expect(isSkeleton(el)).toBe(true);

    vi.advanceTimersByTime(8_000);
    expect(isSkeleton(el)).toBe(false);
  });

  it('stops counting once the post is lifted', () => {
    const el = post();
    showSkeleton(el, t);
    hideSkeleton(el);
    showSkeleton(el, t);
    vi.advanceTimersByTime(9_000);
    // The lifted timer would have fired by now had it survived.
    expect(isSkeleton(el)).toBe(true);
    vi.useRealTimers();
  });
});
