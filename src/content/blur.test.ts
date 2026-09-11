import { beforeEach, describe, expect, it } from 'vitest';
import {
  blur,
  isRevealed,
  listenForReveal,
  reveal,
  revealAll,
  revealPermanently,
} from './blur';

const post = () => {
  document.body.innerHTML = '<div id="p"><span>text</span></div>';
  return document.getElementById('p') as HTMLElement;
};

describe('blur', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('hides the post from assistive tech as well as sight', () => {
    const el = post();
    blur(el);
    expect(el.classList.contains('lx-blur')).toBe(true);
    expect(el.getAttribute('aria-hidden')).toBe('true');
  });

  it('reveal clears both', () => {
    const el = post();
    blur(el);
    reveal(el);
    expect(el.classList.contains('lx-blur')).toBe(false);
    expect(el.hasAttribute('aria-hidden')).toBe(false);
  });

  it('refuses to re-blur a post the user revealed', () => {
    const el = post();
    revealPermanently(el);
    blur(el);
    expect(el.classList.contains('lx-blur')).toBe(false);
    expect(isRevealed(el)).toBe(true);
  });
});

describe('listenForReveal', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('reveals on click and stops the click reaching the post', () => {
    const el = post();
    blur(el);
    const stop = listenForReveal(document);
    let reachedPost = false;
    el.addEventListener('click', () => {
      reachedPost = true;
    });

    el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

    expect(el.classList.contains('lx-blur')).toBe(false);
    expect(reachedPost).toBe(false);
    stop();
  });

  it('lets a second click through once revealed', () => {
    const el = post();
    blur(el);
    const stop = listenForReveal(document);
    el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

    let reachedPost = false;
    el.addEventListener('click', () => {
      reachedPost = true;
    });
    el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

    expect(reachedPost).toBe(true);
    stop();
  });

  it('ignores clicks on posts that were never blurred', () => {
    const el = post();
    const stop = listenForReveal(document);
    let reachedPost = false;
    el.addEventListener('click', () => {
      reachedPost = true;
    });
    el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    expect(reachedPost).toBe(true);
    stop();
  });
});

describe('revealAll', () => {
  it('clears every blur, which is the fail-open escape hatch', () => {
    document.body.innerHTML = '<div class="lx-blur"></div><div class="lx-blur"></div>';
    revealAll(document);
    expect(document.querySelectorAll('.lx-blur')).toHaveLength(0);
  });
});
