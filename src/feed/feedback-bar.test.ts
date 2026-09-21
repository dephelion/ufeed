import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { mountFeedbackBar } from './feedback-bar';
import { createTranslator } from '../core/messages';
import { translate as t } from '../platform/i18n';

const spanish = createTranslator(
  JSON.parse(readFileSync('public/_locales/es/messages.json', 'utf8')),
);

const post = () => {
  const container = document.createElement('article');
  container.getBoundingClientRect = () =>
    ({ top: 0, left: 0, width: 400, height: 200 }) as DOMRect;
  document.body.appendChild(container);
  return container;
};

describe('the thumbs bar', () => {
  it('ignores a thumb while the engine is busy, and takes it once idle', () => {
    const container = post();
    const onFeedback = vi.fn();
    const bar = mountFeedbackBar({
      t,
      postAt: () => ({ container, text: 'a post about rust' }),
      onFeedback,
    });
    container.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
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

    bar.unmount();
  });

  it('writes its titles again when the language changes, busy or not', () => {
    let current = t;
    const bar = mountFeedbackBar({
      t: (key, ...substitutions) => current(key, ...substitutions),
      postAt: () => undefined,
      onFeedback: vi.fn(),
    });
    const up = document.querySelector<HTMLButtonElement>('.lx-fb-up')!;

    bar.setBusy(true);
    current = spanish;
    bar.relabel();
    expect(up.title).toBe('Comprobando publicaciones, un momento');

    bar.setBusy(false);
    expect(up.title).toBe('Dentro del tema');

    bar.unmount();
  });
});
