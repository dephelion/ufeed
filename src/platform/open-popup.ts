/**
 * The posts-hidden badge opens the popup, but a content script cannot call
 * `action.openPopup`. It asks the background, which can. Nothing is carried and
 * nothing is stored: the message is the click.
 */
import browser from 'webextension-polyfill';

const OPEN = 'ufeed:open-popup';

interface Open {
  type: typeof OPEN;
}

const isOpen = (m: unknown): m is Open =>
  typeof m === 'object' && m !== null && (m as Open).type === OPEN;

/**
 * Content side. A missing receiver is not a fault, so a rejection is dropped. So is
 * a throw: after the extension reloads, a page keeps the old script and its badge,
 * and `sendMessage` throws "Extension context invalidated" instead of rejecting.
 */
export function requestPopup(): void {
  try {
    void browser.runtime.sendMessage({ type: OPEN } satisfies Open).catch(() => {});
  } catch {
    // Orphaned script: a page reload brings a live one.
  }
}

/** Background side. Only a tab's content script is honoured, never another extension page. */
export function onPopupRequested(fn: () => void): () => void {
  const listener = (message: unknown, sender: browser.Runtime.MessageSender) => {
    if (!isOpen(message) || sender.tab?.id === undefined) return undefined;
    fn();
    return undefined;
  };
  browser.runtime.onMessage.addListener(listener);
  return () => browser.runtime.onMessage.removeListener(listener);
}
