/**
 * A corner counter of the posts FeedLens is hiding on this page. Once the feed
 * looks calmer it is the one sign the extension is working, and a way back to the
 * popup without hunting for the toolbar icon. See ui.md §Posts-hidden counter.
 */
export interface HiddenBadge {
  setCount(count: number): void;
  setVisible(visible: boolean): void;
  destroy(): void;
}

export interface HiddenBadgeOptions {
  /** The toolbar icon, resolved by the caller: this ring has no extension API. */
  iconUrl: string;
  onClick(): void;
}

export function mountHiddenBadge({ iconUrl, onClick }: HiddenBadgeOptions): HiddenBadge {
  const badge = document.createElement('button');
  badge.type = 'button';
  badge.className = 'lx-count';
  badge.title = 'Open FeedLens';
  badge.hidden = true;

  const icon = document.createElement('img');
  icon.alt = '';
  icon.width = 14;
  icon.height = 14;
  icon.src = iconUrl;
  const label = document.createElement('span');
  badge.append(icon, label);
  badge.addEventListener('click', () => onClick());

  const setCount = (count: number): void => {
    label.textContent = `Posts hidden: ${count}`;
  };
  setCount(0);

  // Firefox keeps a dead content script's badge on reload (see ui.md §No-topics card).
  for (const stale of document.querySelectorAll('.lx-count')) stale.remove();
  document.documentElement.appendChild(badge);

  return {
    setCount,
    setVisible(visible: boolean): void {
      badge.hidden = !visible;
    },
    destroy(): void {
      badge.remove();
    },
  };
}
