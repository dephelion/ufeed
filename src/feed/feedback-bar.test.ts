import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mountFeedbackBar, type FeedbackBarOptions } from './feedback-bar';
import { createTranslator } from '../core/messages';
import { translate as t } from '../platform/i18n';

const spanish = createTranslator(
  JSON.parse(readFileSync('public/_locales/es/messages.json', 'utf8')),
);

const post = (top = 0) => {
  const container = document.createElement('article');
  container.getBoundingClientRect = () =>
    ({ top, bottom: top + 200, left: 0, right: 400, width: 400, height: 200 }) as DOMRect;
  document.body.appendChild(container);
  return container;
};

const mount = (containers: HTMLElement[], overrides: Partial<FeedbackBarOptions> = {}) =>
  mountFeedbackBar({
    t,
    containers: () => containers,
    postAt: (target) => ({ container: target as HTMLElement, text: 'a post about rust' }),
    onFeedback: vi.fn(),
    ...overrides,
  });

afterEach(() => {
  document.body.replaceChildren();
  document.body.style.background = '';
});

describe('the rating buttons', () => {
  it('show on every visible ratable post without a hover', () => {
    const shown = post();
    const offscreen = post(5000);
    const unratable = post(300);
    const bar = mount([shown, offscreen, unratable], {
      postAt: (target) =>
        target === unratable
          ? undefined
          : { container: target as HTMLElement, text: 'x' },
    });

    expect(document.querySelectorAll('.lx-fb')).toHaveLength(1);
    for (const button of document.querySelectorAll<HTMLButtonElement>('.lx-fb button')) {
      expect(button.tabIndex).toBe(-1);
    }
    bar.unmount();
    expect(document.querySelectorAll('.lx-fb')).toHaveLength(0);
  });

  it('replace the buttons an earlier content script left behind', () => {
    const stale = document.createElement('div');
    stale.className = 'lx-fb';
    document.documentElement.appendChild(stale);
    const bar = mount([post()]);

    expect(stale.isConnected).toBe(false);
    expect(document.querySelectorAll('.lx-fb')).toHaveLength(1);
    bar.unmount();
  });

  it("sit inside the post's right edge, centred vertically", () => {
    const bar = mount([post()]);
    const element = document.querySelector<HTMLElement>('.lx-fb')!;

    expect(element.style.left).toBe('397px');
    expect(element.style.top).toBe('100px');
    bar.unmount();
  });

  it('turn light on a light feed and dark on a dark one', () => {
    const container = post();
    const bar = mount([container]);
    expect(document.querySelector('.lx-fb')!.classList.contains('lx-fb-light')).toBe(
      true,
    );
    bar.unmount();

    document.body.style.background = 'rgb(0, 0, 0)';
    const dark = mount([container]);
    expect(document.querySelector('.lx-fb')!.classList.contains('lx-fb-light')).toBe(
      false,
    );
    dark.unmount();
  });

  it('ignore a rating while the engine is busy, and take it once idle', () => {
    const container = post();
    const onFeedback = vi.fn();
    const bar = mount([container], { onFeedback });
    const down = document.querySelector<HTMLButtonElement>('.lx-fb-down')!;

    bar.setBusy(true);
    down.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(onFeedback).not.toHaveBeenCalled();

    bar.setBusy(false);
    down.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(onFeedback).toHaveBeenCalledWith(
      expect.objectContaining({ container }),
      false,
    );
    expect(down.classList.contains('lx-fb-active')).toBe(true);

    bar.unmount();
  });

  it('drop a click, and themselves, once the post under them cannot be rated', () => {
    const container = post();
    const onFeedback = vi.fn();
    let ratable = true;
    const bar = mount([container], {
      onFeedback,
      postAt: (target) =>
        ratable ? { container: target as HTMLElement, text: 'x' } : undefined,
    });
    ratable = false;
    document
      .querySelector<HTMLButtonElement>('.lx-fb-down')!
      .dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(onFeedback).not.toHaveBeenCalled();
    expect(document.querySelector('.lx-fb')).toBeNull();
    bar.unmount();
  });

  it('write their titles again when the language changes, busy or not', () => {
    let current = t;
    const bar = mount([post()], {
      t: (key, ...substitutions) => current(key, ...substitutions),
    });
    const up = document.querySelector<HTMLButtonElement>('.lx-fb-up')!;

    bar.setBusy(true);
    current = spanish;
    bar.relabel();
    expect(up.title).toBe('Valoración de uFeed: comprobando publicaciones, un momento');

    bar.setBusy(false);
    expect(up.title).toBe('Valoración de uFeed: dentro del tema');

    bar.unmount();
  });
});
