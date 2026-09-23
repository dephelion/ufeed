import browser from 'webextension-polyfill';
import { defineBackground } from 'wxt/utils/define-background';
import { adapterFor } from '../adapters';
import { logger } from '../core/log';
import { ENSURE_OFFSCREEN } from '../core/protocol';
import { onPopupRequested } from '../platform/open-popup';
import { onFeedDetected } from '../platform/status-channel';

const log = logger('background');

interface ChromeOffscreen {
  offscreen: {
    createDocument(details: {
      url: string;
      reasons: ['WORKERS'];
      justification: string;
    }): Promise<void>;
  };
  runtime: {
    getContexts?(filter: {
      contextTypes: ['OFFSCREEN_DOCUMENT'];
      documentUrls: string[];
    }): Promise<unknown[]>;
  };
}

let creatingOffscreen: Promise<boolean> | undefined;

async function ensureOffscreen(): Promise<boolean> {
  const api = (globalThis as unknown as { chrome?: ChromeOffscreen }).chrome;
  if (!api?.offscreen) return false;
  creatingOffscreen ??= (async () => {
    const url = browser.runtime.getURL('offscreen.html');
    if (api.runtime.getContexts) {
      const existing = await api.runtime.getContexts({
        contextTypes: ['OFFSCREEN_DOCUMENT'],
        documentUrls: [url],
      });
      if (existing.length > 0) return true;
    } else {
      const existing = await (
        self as unknown as { clients: { matchAll(): Promise<{ url: string }[]> } }
      ).clients.matchAll();
      if (existing.some((client) => client.url === url)) return true;
    }
    await api.offscreen.createDocument({
      url,
      reasons: ['WORKERS'],
      justification: 'Share one on-device Gemma worker across feed tabs',
    });
    return true;
  })()
    .catch((error: unknown) => {
      log.warn('shared engine unavailable', {
        reason: error instanceof Error ? error.message : String(error),
      });
      return false;
    })
    .finally(() => {
      creatingOffscreen = undefined;
    });
  return creatingOffscreen;
}

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

interface CallbackAction {
  action: {
    setIcon(
      details: { tabId: number; path: Record<string, string> },
      done: () => void,
    ): void;
  };
  runtime: { lastError?: unknown };
}

const callbackApi = (globalThis as unknown as { chrome: CallbackAction }).chrome;

// Chrome's setIcon binding reports a stale tab id as "Unchecked runtime.lastError" even when the
// promise is caught; only reading lastError in a callback marks it handled. See conventions.md §4.
function setIcon(tabId: number, path: Record<string, string>): void {
  callbackApi.action.setIcon({ tabId, path }, () => void callbackApi.runtime.lastError);
}

/** Chrome opens it from 127 and Firefox only from a user action; elsewhere it refuses. */
async function openPopup(): Promise<void> {
  try {
    await browser.action.openPopup();
  } catch (error) {
    log.warn('popup did not open', {
      reason: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Colored the moment a tab confirms it has a feed uFeed knows how to read —
 * whatever happens after that (still loading, warming up, failing outright)
 * is a separate question. Detecting the feed is the work that matters here;
 * gray means there was none to find.
 */
export default defineBackground(() => {
  browser.runtime.onMessage.addListener((message: unknown) => {
    if (
      typeof message === 'object' &&
      message !== null &&
      'type' in message &&
      message.type === ENSURE_OFFSCREEN
    )
      return ensureOffscreen();
    return undefined;
  });
  onFeedDetected((tabId) => {
    setIcon(tabId, COLOR);
  });
  onPopupRequested(() => void openPopup());

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
