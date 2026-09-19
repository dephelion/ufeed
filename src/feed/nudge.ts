import browser from 'webextension-polyfill';

/**
 * The card shown when FeedLens is on and has no topics. That state is invisible
 * otherwise — the feed looks untouched, which reads as a broken install rather
 * than an unfinished setup, and a reader who cannot tell will just uninstall.
 *
 * It cannot open the popup for them: `action.openPopup` is not reachable from a
 * content script. So it points at the toolbar icon and shows that icon, which is
 * the part a new user has to find.
 */
export interface Nudge {
  setVisible(visible: boolean): void;
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

export function mountNudge(): Nudge {
  const card = document.createElement('div');
  card.className = 'lx-nudge';
  card.setAttribute('role', 'status');
  card.hidden = true;

  // Gray, not the branded color icon: this card only shows while the tab has
  // no topics, which is exactly the state that leaves the toolbar icon gray.
  const icon = browser.runtime.getURL('icon-gray/48.png');
  card.innerHTML =
    `<img class="lx-nudge-icon" src="${icon}" alt="" width="28" height="28">` +
    '<div class="lx-nudge-body">' +
    '<b>FeedLens has no topics yet</b>' +
    '<p>It is on, but it does not know what you want to see, so nothing is ' +
    'being blurred. Open the icon above in your browser toolbar and add a ' +
    'topic or two.</p>' +
    '</div>' +
    '<button type="button" class="lx-nudge-x" aria-label="Hide until the next ' +
    'page load">&times;</button>';

  // Dismissal lives for this page load only. Persisting it would leave the
  // reader with a silent extension and no way back to the explanation.
  let dismissed = false;
  let wanted = false;

  const paint = () => {
    card.hidden = !(wanted && !dismissed);
  };

  card.querySelector('.lx-nudge-x')!.addEventListener('click', () => {
    dismissed = true;
    paint();
  });

  const stopWaiting = whenBody((body) => body.append(card));

  return {
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
