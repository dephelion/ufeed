import type { Translate } from '../core/messages';

/**
 * The card shown when uFeed is on and has no topics. That state is invisible
 * otherwise — the feed looks untouched, which reads as a broken install rather
 * than an unfinished setup, and a reader who cannot tell will just uninstall.
 *
 * It cannot open the popup for them: `action.openPopup` is not reachable from a
 * content script. So it points at the toolbar icon and shows that icon, which is
 * the part a new user has to find.
 */
export interface Nudge {
  setVisible(visible: boolean): void;
  /** Writes the text again, for a `t` that now answers in another language. */
  relabel(): void;
  destroy(): void;
}

const BODY_POLL_MS = 50;

/** document_start means there may be no body yet; the card cannot wait on load. */
function whenBody(attach: (body: HTMLElement) => void): () => void {
  if (document.body) {
    attach(document.body);
    return () => {};
  }
  const timer = setInterval(() => {
    if (!document.body) return;
    clearInterval(timer);
    attach(document.body);
  }, BODY_POLL_MS);
  return () => clearInterval(timer);
}

/** `iconUrl` is the gray toolbar icon, resolved by the caller: this ring has no extension API. */
export function mountNudge(iconUrl: string, t: Translate): Nudge {
  const card = document.createElement('div');
  card.className = 'lx-nudge';
  card.setAttribute('role', 'status');
  card.hidden = true;

  // Gray, not the branded color icon: this card only shows while the tab has
  // no topics, which is exactly the state that leaves the toolbar icon gray.
  const icon = document.createElement('img');
  icon.className = 'lx-nudge-icon';
  icon.alt = '';
  icon.width = 28;
  icon.height = 28;
  icon.src = iconUrl;

  const title = document.createElement('b');
  const text = document.createElement('p');
  const body = document.createElement('div');
  body.className = 'lx-nudge-body';
  body.append(title, text);

  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'lx-nudge-x';
  close.textContent = '\u00d7';

  const relabel = (): void => {
    title.textContent = t('nudgeTitle');
    text.textContent = t('nudgeBody');
    close.setAttribute('aria-label', t('nudgeDismiss'));
  };
  relabel();

  card.append(icon, body, close);

  // Dismissal lives for this page load only. Persisting it would leave the
  // reader with a silent extension and no way back to the explanation.
  let dismissed = false;
  let wanted = false;

  const paint = () => {
    card.hidden = !(wanted && !dismissed);
  };

  close.addEventListener('click', () => {
    dismissed = true;
    paint();
  });

  // Firefox leaves a dead content script's card behind on reload (see ui.md §No-topics card).
  const stopWaiting = whenBody((body) => {
    for (const stale of body.querySelectorAll('.lx-nudge')) stale.remove();
    body.append(card);
  });

  return {
    relabel,
    setVisible(visible: boolean): void {
      // Re-entering the state is a fresh reason to speak, so the × resets.
      if (visible && !wanted) dismissed = false;
      wanted = visible;
      paint();
    },
    destroy(): void {
      stopWaiting();
      card.remove();
    },
  };
}
