import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mountHiddenBadge } from './hidden-badge';
import { createTranslator } from '../core/messages';
import { translate as t } from '../platform/i18n';

const spanish = createTranslator(
  JSON.parse(readFileSync('public/_locales/es/messages.json', 'utf8')),
);

const ICON = 'moz-extension://id/icon/32.png';
const badge = () => document.querySelector<HTMLButtonElement>('.lx-count')!;

describe('mountHiddenBadge', () => {
  beforeEach(() => {
    for (const stale of document.querySelectorAll('.lx-count')) stale.remove();
  });

  it('starts hidden, counting zero', () => {
    const mounted = mountHiddenBadge({ iconUrl: ICON, t, onClick: () => {} });
    expect(badge().hidden).toBe(true);
    expect(badge().textContent).toBe('Posts hidden: 0');
    mounted.destroy();
  });

  it('shows the count and follows visibility', () => {
    const mounted = mountHiddenBadge({ iconUrl: ICON, t, onClick: () => {} });
    mounted.setCount(12);
    mounted.setVisible(true);
    expect(badge().textContent).toBe('Posts hidden: 12');
    expect(badge().hidden).toBe(false);
    mounted.setVisible(false);
    expect(badge().hidden).toBe(true);
    mounted.destroy();
  });

  it('writes its text again when the language changes, keeping the count', () => {
    let current = t;
    const mounted = mountHiddenBadge({
      iconUrl: ICON,
      t: (key, ...substitutions) => current(key, ...substitutions),
      onClick: () => {},
    });
    mounted.setCount(4);
    current = spanish;
    mounted.relabel();
    expect(badge().textContent).toBe('Publicaciones ocultas: 4');
    expect(badge().title).toBe('Abrir FeedLens');
    mounted.destroy();
  });

  it('carries the icon it was given', () => {
    const mounted = mountHiddenBadge({ iconUrl: ICON, t, onClick: () => {} });
    expect(badge().querySelector('img')!.getAttribute('src')).toBe(ICON);
    mounted.destroy();
  });

  it('asks for the popup on click', () => {
    const onClick = vi.fn();
    const mounted = mountHiddenBadge({ iconUrl: ICON, t, onClick });
    badge().click();
    expect(onClick).toHaveBeenCalledTimes(1);
    mounted.destroy();
  });

  it('replaces a badge left behind by a dead content script', () => {
    const orphan = document.createElement('button');
    orphan.className = 'lx-count';
    document.documentElement.append(orphan);

    const mounted = mountHiddenBadge({ iconUrl: ICON, t, onClick: () => {} });
    expect(document.querySelectorAll('.lx-count')).toHaveLength(1);
    expect(orphan.isConnected).toBe(false);
    mounted.destroy();
  });
});
