import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { mountNudge } from './nudge';
import { createTranslator } from '../core/messages';
import { translate as t } from '../platform/i18n';

const ICON = 'moz-extension://id/icon-gray/48.png';
const spanish = createTranslator(
  JSON.parse(readFileSync('public/_locales/es/messages.json', 'utf8')),
);

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

  it('writes its text again when the language changes', () => {
    let current = t;
    const nudge = mountNudge(ICON, (key, ...substitutions) =>
      current(key, ...substitutions),
    );
    current = spanish;
    nudge.relabel();
    const card = document.querySelector<HTMLElement>('.lx-nudge')!;
    expect(card.querySelector('b')!.textContent).toBe('FeedLens aún no tiene temas');
    expect(card.querySelector('.lx-nudge-x')!.getAttribute('aria-label')).toBe(
      spanish('nudgeDismiss'),
    );
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
