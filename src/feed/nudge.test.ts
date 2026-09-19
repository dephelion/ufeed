import { describe, expect, it, vi } from 'vitest';

vi.mock('webextension-polyfill', () => ({
  default: { runtime: { getURL: (p: string) => `moz-extension://id/${p}` } },
}));

const { mountNudge } = await import('./nudge');

describe('mountNudge', () => {
  it('hides on ×', () => {
    const nudge = mountNudge();
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

    const nudge = mountNudge();
    expect(document.querySelectorAll('.lx-nudge')).toHaveLength(1);
    expect(orphan.isConnected).toBe(false);
    nudge.destroy();
  });
});
