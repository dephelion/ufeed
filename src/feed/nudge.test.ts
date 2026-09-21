import { describe, expect, it } from 'vitest';
import { mountNudge } from './nudge';
import { translate as t } from '../platform/i18n';

const ICON = 'moz-extension://id/icon-gray/48.png';

describe('mountNudge', () => {
  it('hides on ×', () => {
    const nudge = mountNudge(ICON, t);
    nudge.setVisible(true);
    const card = document.querySelector<HTMLElement>('.lx-nudge')!;
    expect(card.hidden).toBe(false);
    card.querySelector<HTMLButtonElement>('.lx-nudge-x')!.click();
    expect(card.hidden).toBe(true);
    nudge.destroy();
  });

  it('replaces a card left behind by a dead content script', () => {
    const orphan = document.createElement('div');
    orphan.className = 'lx-nudge';
    document.body.append(orphan);

    const nudge = mountNudge(ICON, t);
    expect(document.querySelectorAll('.lx-nudge')).toHaveLength(1);
    expect(orphan.isConnected).toBe(false);
    nudge.destroy();
  });
});
