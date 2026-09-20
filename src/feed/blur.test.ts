import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  blur,
  peek,
  isBlurred,
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

  it('leaves a post uncollapsed by default', () => {
    const el = post();
    blur(el);
    expect(el.classList.contains('lx-collapse')).toBe(false);
  });

  it('collapses a post on request', () => {
    const el = post();
    blur(el, 'topic', true);
    expect(el.classList.contains('lx-blur')).toBe(true);
    expect(el.classList.contains('lx-collapse')).toBe(true);
  });

  it('drops the collapse class when re-blurred without it', () => {
    const el = post();
    blur(el, 'topic', true);
    blur(el, 'topic', false);
    expect(el.classList.contains('lx-collapse')).toBe(false);
  });

  it('collapses a peek on request', () => {
    const el = post();
    peek(el, 'opening words', true);
    expect(el.classList.contains('lx-collapse')).toBe(true);
  });

  it('reveal clears the collapse class too', () => {
    const el = post();
    blur(el, 'topic', true);
    reveal(el);
    expect(el.classList.contains('lx-collapse')).toBe(false);
  });
});

describe('isBlurred', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('is false before anything runs', () => {
    expect(isBlurred(post())).toBe(false);
  });

  it('is true whether or not the blur is collapsed', () => {
    const el = post();
    blur(el, 'topic', true);
    expect(isBlurred(el)).toBe(true);
  });

  it('is false again once revealed', () => {
    const el = post();
    blur(el);
    reveal(el);
    expect(isBlurred(el)).toBe(false);
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

describe('keyboard and screen-reader reveal', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  const linkInside = () => {
    document.body.innerHTML = '<div id="p"><a id="link" href="#post">text</a></div>';
    return document.getElementById('link') as HTMLElement;
  };
  const enter = () =>
    new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });

  it('reveals on Enter from anything focused inside, without opening the post', () => {
    const link = linkInside();
    const el = link.parentElement!;
    blur(el);
    const stop = listenForReveal(document);
    const key = enter();

    link.dispatchEvent(key);

    expect(isBlurred(el)).toBe(false);
    expect(key.defaultPrevented).toBe(true);
    stop();
  });

  it('leaves Enter alone on a post that is not blurred', () => {
    const link = linkInside();
    const stop = listenForReveal(document);
    const key = enter();

    link.dispatchEvent(key);

    expect(key.defaultPrevented).toBe(false);
    stop();
  });

  it('tells a screen reader why the focused post is hidden and how to read it', () => {
    vi.useFakeTimers();
    const link = linkInside();
    blur(link.parentElement!, 'language');
    const stop = listenForReveal(document);

    link.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    vi.advanceTimersByTime(100);

    const said = document.querySelector('[role="status"]')?.textContent ?? '';
    expect(said).toContain('another language');
    expect(said).toContain('Enter');
    stop();
    vi.useRealTimers();
  });
});

describe('revealAll', () => {
  it('clears every blur, which is the fail-open escape hatch', () => {
    document.body.innerHTML = '<div class="lx-blur"></div><div class="lx-blur"></div>';
    revealAll(document);
    expect(document.querySelectorAll('.lx-blur')).toHaveLength(0);
  });
});

describe('peek', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('blurs the post but carries its opening words', () => {
    const el = post();
    const text =
      'Los circuitos de test son artificiales, creados por la mano del hombre.';
    peek(el, text);
    expect(el.classList.contains('lx-blur')).toBe(true);
    expect(el.dataset.lxReason).toBe('peek');
    expect(text.startsWith(el.dataset.lxPeek!)).toBe(true);
    expect(el.dataset.lxPeek!.length).toBeLessThan(text.length);
  });

  it('passes a short post through whole rather than truncating nothing', () => {
    const el = post();
    peek(el, 'short one');
    expect(el.dataset.lxPeek).toBe('short one');
  });

  it('never touches the host DOM, only attributes', () => {
    const el = post();
    const before = el.innerHTML;
    peek(el, 'some borderline post text that is long enough to be cut');
    expect(el.innerHTML).toBe(before);
  });

  it('clears the peek on reveal, so a recycled node never shows stale words', () => {
    const el = post();
    peek(el, 'borderline text');
    reveal(el);
    expect(el.dataset.lxPeek).toBeUndefined();
    expect(el.dataset.lxReason).toBeUndefined();
  });

  it('leaves a permanently revealed post alone', () => {
    const el = post();
    revealPermanently(el);
    peek(el, 'borderline text');
    expect(el.classList.contains('lx-blur')).toBe(false);
    expect(el.dataset.lxPeek).toBeUndefined();
  });
});
