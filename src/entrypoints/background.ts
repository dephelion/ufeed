import browser from 'webextension-polyfill';
import { defineBackground } from 'wxt/utils/define-background';
import { adapterFor } from '../adapters';
import { onFeedDetected } from '../core/status-channel';

const SIZES = ['16', '32', '48', '128'] as const;

const iconSet = (dir: string): Record<string, string> =>
  Object.fromEntries(SIZES.map((size) => [size, `${dir}/${size}.png`]));

/** Default in the manifest, so a tab that never mentions a feed stays this way. */
const GRAY = iconSet('icon-gray');
const COLOR = iconSet('icon');

/** Undefined for a redacted or missing URL, not a thrown parse error. */
function urlHost(url: string | undefined): string | undefined {
  if (!url) return undefined;
  try {
    return new URL(url).hostname;
  } catch {
    return undefined;
  }
}

/**
 * The tab named in a setIcon call can close, or navigate to a discarded id,
 * between the event firing and this running. Chrome answers with
 * `runtime.lastError`, and an uncaught one prints as an "Unchecked
 * runtime.lastError" extension error — a race, not a fault, so it is
 * swallowed the same way status-channel.ts already swallows a popup that
 * is not there to hear a broadcast.
 */
function setIcon(tabId: number, path: Record<string, string>): void {
  void browser.action.setIcon({ tabId, path }).catch(() => {});
}

/**
 * Colored the moment a tab confirms it has a feed Lensing knows how to read —
 * whatever happens after that (still loading, warming up, failing outright)
 * is a separate question. Detecting the feed is the work that matters here;
 * gray means there was none to find.
 */
export default defineBackground(() => {
  onFeedDetected((tabId) => {
    setIcon(tabId, COLOR);
  });

  // A tab that goes color on x.com and then navigates to a plain page keeps
  // that per-tab icon forever otherwise — setIcon does not revert on its own.
  // Gray only once the URL confirms the tab left every feed host: x.com in
  // particular redirects client-side after its first load, which fires more
  // than one 'loading' event for a single visit, and graying on all of them
  // raced the content script's own color signal and sometimes won.
  browser.tabs.onUpdated.addListener((tabId, info, tab) => {
    const host = urlHost(info.url ?? tab.url);
    const feed = host !== undefined && adapterFor(host) !== undefined;
    if (info.status === 'loading' && !feed) setIcon(tabId, GRAY);
    // Chrome clears per-tab icons when a page commits, and a prerendered or
    // back/forward-cached page commits without re-running the content script.
    if (info.status === 'complete' && feed) setIcon(tabId, COLOR);
  });
});
