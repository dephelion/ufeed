import { describe, expect, it, vi } from 'vitest';
import { mountFeedbackBar } from './feedback-bar';
import { translate as t } from '../platform/i18n';

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
});
