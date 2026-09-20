import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mountHiddenBadge } from './hidden-badge';

const ICON = 'moz-extension://id/icon/32.png';
const badge = () => document.querySelector<HTMLButtonElement>('.lx-count')!;

describe('mountHiddenBadge', () => {
  beforeEach(() => {
    for (const stale of document.querySelectorAll('.lx-count')) stale.remove();
  });

  it('starts hidden, counting zero', () => {
    const mounted = mountHiddenBadge({ iconUrl: ICON, onClick: () => {} });
    expect(badge().hidden).toBe(true);
    expect(badge().textContent).toBe('Posts hidden: 0');
    mounted.destroy();
  });

  it('shows the count and follows visibility', () => {
    const mounted = mountHiddenBadge({ iconUrl: ICON, onClick: () => {} });
    mounted.setCount(12);
    mounted.setVisible(true);
    expect(badge().textContent).toBe('Posts hidden: 12');
    expect(badge().hidden).toBe(false);
    mounted.setVisible(false);
    expect(badge().hidden).toBe(true);
    mounted.destroy();
  });

  it('carries the icon it was given', () => {
    const mounted = mountHiddenBadge({ iconUrl: ICON, onClick: () => {} });
    expect(badge().querySelector('img')!.getAttribute('src')).toBe(ICON);
    mounted.destroy();
  });

  it('asks for the popup on click', () => {
    const onClick = vi.fn();
    const mounted = mountHiddenBadge({ iconUrl: ICON, onClick });
    badge().click();
    expect(onClick).toHaveBeenCalledTimes(1);
    mounted.destroy();
  });

  it('replaces a badge left behind by a dead content script', () => {
    const orphan = document.createElement('button');
    orphan.className = 'lx-count';
    document.documentElement.append(orphan);

    const mounted = mountHiddenBadge({ iconUrl: ICON, onClick: () => {} });
    expect(document.querySelectorAll('.lx-count')).toHaveLength(1);
    expect(orphan.isConnected).toBe(false);
    mounted.destroy();
  });
});
