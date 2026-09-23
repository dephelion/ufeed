import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  blur,
  peek,
  isBlurred,
  isRevealed,
  listenForReveal,
  relabelBlurred,
  reveal,
  revealAll,
  revealPermanently,
} from './blur';
import { createTranslator } from '../core/messages';
import { translate as t } from '../platform/i18n';

const spanish = createTranslator(
  JSON.parse(readFileSync('public/_locales/es/messages.json', 'utf8')),
);

const post = () => {
  document.body.innerHTML = '<div id="p"><span>text</span></div>';
  return document.getElementById('p') as HTMLElement;
};

/** happy-dom lays nothing out, so a post with a height is a post with a stubbed one. */
const standing = (height: number) => {
  const el = post();
  Object.defineProperty(el, 'offsetHeight', { value: height, configurable: true });
  return el;
};

describe('blur', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('hides the post from assistive tech as well as sight', () => {
    const el = post();
    blur(el, t);
    expect(el.classList.contains('lx-blur')).toBe(true);
    expect(el.getAttribute('aria-hidden')).toBe('true');
  });

  it('writes the label the stylesheet draws, and takes it away on reveal', () => {
    const el = post();
    blur(el, t, 'media');
    expect(el.dataset.lxLabel).toBe(t('labelMedia'));
    peek(el, t, 'opening words');
    expect(el.dataset.lxLabel).toBe(t('labelPeek'));
    reveal(el);
    expect(el.dataset.lxLabel).toBeUndefined();
  });

  it('reveal clears both', () => {
    const el = post();
    blur(el, t);
    reveal(el);
    expect(el.classList.contains('lx-blur')).toBe(false);
    expect(el.hasAttribute('aria-hidden')).toBe(false);
  });

  it('refuses to re-blur a post the user revealed', () => {
    const el = post();
    revealPermanently(el, t);
    blur(el, t);
    expect(el.classList.contains('lx-blur')).toBe(false);
    expect(isRevealed(el)).toBe(true);
  });

  it('leaves a post uncollapsed by default', () => {
    const el = post();
    blur(el, t);
    expect(el.classList.contains('lx-collapse')).toBe(false);
  });

  it('collapses a post on request', () => {
    const el = post();
    blur(el, t, 'topic', true);
    expect(el.classList.contains('lx-blur')).toBe(true);
    expect(el.classList.contains('lx-collapse')).toBe(true);
  });

  it('drops the collapse class when re-blurred without it', () => {
    const el = post();
    blur(el, t, 'topic', true);
    blur(el, t, 'topic', false);
    expect(el.classList.contains('lx-collapse')).toBe(false);
  });

  it('collapses a peek on request', () => {
    const el = post();
    peek(el, t, 'opening words', true);
    expect(el.classList.contains('lx-collapse')).toBe(true);
  });

  it('reveal clears the collapse class too', () => {
    const el = post();
    blur(el, t, 'topic', true);
    reveal(el);
    expect(el.classList.contains('lx-collapse')).toBe(false);
  });

  it('gives the slide the height the post had, and takes it back on reveal', () => {
    const el = standing(400);
    blur(el, t, 'topic', true);
    expect(el.style.getPropertyValue('--lx-h')).toBe('400px');
    reveal(el);
    expect(el.style.getPropertyValue('--lx-h')).toBe('');
  });

  it('never re-measures a collapsed post: the shut row is not a start height', () => {
    const el = standing(400);
    blur(el, t, 'topic', true);
    Object.defineProperty(el, 'offsetHeight', { value: 30, configurable: true });
    blur(el, t, 'blacklist', true);
    expect(el.style.getPropertyValue('--lx-h')).toBe('400px');
  });

  it('leaves the height unset when the post has no layout, so it collapses at once', () => {
    const el = standing(0);
    blur(el, t, 'topic', true);
    expect(el.style.getPropertyValue('--lx-h')).toBe('');
  });

  it('a clicked post expands, keeping the height the collapse measured', () => {
    const el = standing(400);
    blur(el, t, 'topic', true);
    revealPermanently(el, t);
    expect(el.classList.contains('lx-expand')).toBe(true);
    expect(el.style.getPropertyValue('--lx-h')).toBe('400px');
  });

  it('a post revealed any other way does not expand, and gives the height back', () => {
    const el = standing(400);
    blur(el, t, 'topic', true);
    reveal(el);
    expect(el.classList.contains('lx-expand')).toBe(false);
    expect(el.style.getPropertyValue('--lx-h')).toBe('');
  });

  it('never expands a post that was never collapsed: there is nothing to undo', () => {
    const el = standing(400);
    blur(el, t, 'topic', false);
    revealPermanently(el, t);
    expect(el.classList.contains('lx-expand')).toBe(false);
  });
});

describe('relabelBlurred', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('writes the label of every blurred post again, peek words untouched', () => {
    const make = () => document.body.appendChild(document.createElement('div'));
    const blurred = make();
    const peeked = make();
    const plain = make();
    blur(blurred, t);
    peek(peeked, t, 'opening words');

    relabelBlurred(spanish);

    expect(blurred.dataset.lxLabel).toBe('Fuera de tema — clic para leer');
    expect(peeked.dataset.lxLabel).toBe(spanish('labelPeek'));
    expect(peeked.dataset.lxPeek).toBe('opening words');
    expect(plain.dataset.lxLabel).toBeUndefined();
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
    blur(el, t, 'topic', true);
    expect(isBlurred(el)).toBe(true);
  });

  it('is false again once revealed', () => {
    const el = post();
    blur(el, t);
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
    blur(el, t);
    const stop = listenForReveal(t, document);
    let reachedPost = false;
    el.addEventListener('click', () => {
      reachedPost = true;
    });

    el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

    expect(el.classList.contains('lx-blur')).toBe(false);
    expect(reachedPost).toBe(false);
    stop();
  });

  it('keeps a tag saying why the opened post had been hidden', () => {
    const el = post();
    blur(el, t, 'language');
    const stop = listenForReveal(t, document);
    el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

    expect(el.dataset.lxOpened).toBe('language');
    expect(el.dataset.lxLabel).toBe('Another language');
    expect(el.getAttribute('aria-hidden')).toBeNull();
    stop();
  });

  it('lets a second click through once revealed', () => {
    const el = post();
    blur(el, t);
    const stop = listenForReveal(t, document);
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
    const stop = listenForReveal(t, document);
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
    blur(el, t);
    const stop = listenForReveal(t, document);
    const key = enter();

    link.dispatchEvent(key);

    expect(isBlurred(el)).toBe(false);
    expect(key.defaultPrevented).toBe(true);
    stop();
  });

  it('leaves Enter alone on a post that is not blurred', () => {
    const link = linkInside();
    const stop = listenForReveal(t, document);
    const key = enter();

    link.dispatchEvent(key);

    expect(key.defaultPrevented).toBe(false);
    stop();
  });

  it('tells a screen reader why the focused post is hidden and how to read it', () => {
    vi.useFakeTimers();
    const link = linkInside();
    blur(link.parentElement!, t, 'language');
    const stop = listenForReveal(t, document);

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

  it('takes the tags off opened posts too, so a turned-off tab is the host page again', () => {
    const el = post();
    blur(el, t);
    revealPermanently(el, t);
    revealAll(document);
    expect(el.dataset.lxOpened).toBeUndefined();
    expect(el.dataset.lxLabel).toBeUndefined();
  });
});

describe('the blacklist tag', () => {
  it('names the keyword that blocked the post, in any language', () => {
    const el = post();
    blur(el, t, 'blacklist');
    el.dataset.lxKeyword = 'crypto';
    revealPermanently(el, t);
    expect(el.dataset.lxLabel).toBe('Blocked keyword (crypto)');

    relabelBlurred(spanish);
    expect(el.dataset.lxLabel).toBe('Palabra bloqueada (crypto)');
  });

  it('forgets the keyword once the post is the host page again', () => {
    const el = post();
    blur(el, t, 'blacklist');
    el.dataset.lxKeyword = 'crypto';
    revealPermanently(el, t);
    revealAll(document);
    expect(el.dataset.lxKeyword).toBeUndefined();
  });
});

describe('relabelBlurred on opened posts', () => {
  it('rewrites the tag in the new language', () => {
    const el = post();
    blur(el, t, 'language');
    revealPermanently(el, t);
    relabelBlurred(spanish);
    expect(el.dataset.lxLabel).toBe('Otro idioma');
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
    peek(el, t, text);
    expect(el.classList.contains('lx-blur')).toBe(true);
    expect(el.dataset.lxReason).toBe('peek');
    expect(text.startsWith(el.dataset.lxPeek!)).toBe(true);
    expect(el.dataset.lxPeek!.length).toBeLessThan(text.length);
  });

  it('passes a short post through whole rather than truncating nothing', () => {
    const el = post();
    peek(el, t, 'short one');
    expect(el.dataset.lxPeek).toBe('short one');
  });

  it('never touches the host DOM, only attributes', () => {
    const el = post();
    const before = el.innerHTML;
    peek(el, t, 'some borderline post text that is long enough to be cut');
    expect(el.innerHTML).toBe(before);
  });

  it('clears the peek on reveal, so a recycled node never shows stale words', () => {
    const el = post();
    peek(el, t, 'borderline text');
    reveal(el);
    expect(el.dataset.lxPeek).toBeUndefined();
    expect(el.dataset.lxReason).toBeUndefined();
  });

  it('leaves a permanently revealed post alone', () => {
    const el = post();
    revealPermanently(el, t);
    peek(el, t, 'borderline text');
    expect(el.classList.contains('lx-blur')).toBe(false);
    expect(el.dataset.lxPeek).toBeUndefined();
  });
});
