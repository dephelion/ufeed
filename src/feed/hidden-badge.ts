import type { Translate } from '../core/messages';

/**
 * A corner counter of the posts uFeed is hiding on this page. Once the feed
 * looks calmer it is the one sign the extension is working, and a way back to the
 * popup without hunting for the toolbar icon. See ui.md §Posts-hidden counter.
 */
export interface HiddenBadge {
  setCount(count: number): void;
  setVisible(visible: boolean): void;
  /** Writes the text again, for a `t` that now answers in another language. */
  relabel(): void;
  destroy(): void;
}

export interface HiddenBadgeOptions {
  /** The toolbar icon, resolved by the caller: this ring has no extension API. */
  iconUrl: string;
  t: Translate;
  onClick(): void;
}

export function mountHiddenBadge({
  iconUrl,
  t,
  onClick,
}: HiddenBadgeOptions): HiddenBadge {
  const badge = document.createElement('button');
  badge.type = 'button';
  badge.className = 'lx-count';
  badge.hidden = true;

  const icon = document.createElement('img');
  icon.alt = '';
  icon.width = 14;
  icon.height = 14;
  icon.src = iconUrl;
  const label = document.createElement('span');
  badge.append(icon, label);
  badge.addEventListener('click', () => onClick());

  let count = 0;
  const relabel = (): void => {
    badge.title = t('badgeOpen');
    label.textContent = t('badgeCount', String(count));
  };
  relabel();

  // Firefox keeps a dead content script's badge on reload (see ui.md §No-topics card).
  for (const stale of document.querySelectorAll('.lx-count')) stale.remove();
  document.documentElement.appendChild(badge);

  return {
    setCount(next: number): void {
      count = next;
      relabel();
    },
    relabel,
    setVisible(visible: boolean): void {
      badge.hidden = !visible;
    },
    destroy(): void {
      badge.remove();
    },
  };
}
