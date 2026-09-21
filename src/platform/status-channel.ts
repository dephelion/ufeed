/**
 * The popup asks the tab on screen what its engine is doing, and nothing is
 * stored. That matters three ways:
 *
 * - **Correct.** Each feed tab runs its own engine. A shared value meant the
 *   popup showed whichever tab wrote last, which is rarely the one you are
 *   looking at.
 * - **Honest.** A tab with no engine answers nothing, so the popup can say so
 *   instead of showing a stale "ready" borrowed from another tab.
 * - **Private.** The status carried a timestamp, and writing it to storage left
 *   a durable record of when a feed was last open. Asking live writes nothing,
 *   keeps nothing, and survives no restart.
 *
 * Costs no new permission: the active tab's id needs none, and reaching its
 * content script is already covered by the feed host permissions.
 */
import browser from 'webextension-polyfill';
import type { EngineStatus } from '../core/engine-status';

const ASK = 'ufeed:status?';
const TELL = 'ufeed:status';
const FEED = 'ufeed:feed';

interface Ask {
  type: typeof ASK;
}

interface Tell {
  type: typeof TELL;
  status: EngineStatus;
}

interface Feed {
  type: typeof FEED;
}

const isAsk = (m: unknown): m is Ask =>
  typeof m === 'object' && m !== null && (m as Ask).type === ASK;

const isTell = (m: unknown): m is Tell =>
  typeof m === 'object' && m !== null && (m as Tell).type === TELL;

const isFeed = (m: unknown): m is Feed =>
  typeof m === 'object' && m !== null && (m as Feed).type === FEED;

/** Content side: answer whenever asked. `current` is read at answer time. */
export function serveEngineStatus(current: () => EngineStatus): () => void {
  const listener = (message: unknown) =>
    isAsk(message) ? Promise.resolve(current()) : undefined;
  browser.runtime.onMessage.addListener(listener);
  return () => browser.runtime.onMessage.removeListener(listener);
}

/** Content side: push a change so an open popup ticks along with the download. */
export function publishEngineStatus(status: EngineStatus): void {
  // With no popup open there is no receiver and this rejects. That is the
  // normal case, not a fault.
  void browser.runtime.sendMessage({ type: TELL, status } satisfies Tell).catch(() => {});
}

export interface TabStatus {
  /** The tab the popup is standing over, or undefined if it has no id. */
  tabId: number | undefined;
  /** Undefined when that tab runs no engine: not a feed, or not yet injected. */
  status: EngineStatus | undefined;
}

/** Popup side: ask the tab on screen, once, at open. */
export async function askEngineStatus(): Promise<TabStatus> {
  const [tab] = await browser.tabs
    .query({ active: true, currentWindow: true })
    .catch(() => []);
  if (tab?.id === undefined) return { tabId: undefined, status: undefined };
  try {
    const reply = (await browser.tabs.sendMessage(tab.id, {
      type: ASK,
    } satisfies Ask)) as EngineStatus | undefined;
    return { tabId: tab.id, status: reply };
  } catch {
    // No content script there to answer, which is itself the answer.
    return { tabId: tab.id, status: undefined };
  }
}

/**
 * Popup side: follow one tab. Every feed tab broadcasts, so without the sender
 * check a background tab's download would overwrite the foreground tab's state —
 * the same bug the shared storage value had.
 */
export function onEngineStatus(
  tabId: number | undefined,
  fn: (status: EngineStatus) => void,
): () => void {
  const listener = (message: unknown, sender: browser.Runtime.MessageSender) => {
    if (!isTell(message) || sender.tab?.id !== tabId) return undefined;
    fn(message.status);
    return undefined;
  };
  browser.runtime.onMessage.addListener(listener);
  return () => browser.runtime.onMessage.removeListener(listener);
}

/**
 * Content side: once, the moment an adapter matches — before settings, the
 * engine, or anything that can fail. The toolbar icon reads this as "this tab
 * is uFeed's business", full stop; whether filtering ever actually starts
 * is a separate question the icon does not need to answer.
 */
export function publishFeedDetected(): void {
  void browser.runtime.sendMessage({ type: FEED } satisfies Feed).catch(() => {});
}

/** Background side: colors a tab's icon the moment that tab confirms a feed. */
export function onFeedDetected(fn: (tabId: number) => void): () => void {
  const listener = (message: unknown, sender: browser.Runtime.MessageSender) => {
    if (!isFeed(message) || sender.tab?.id === undefined) return undefined;
    fn(sender.tab.id);
    return undefined;
  };
  browser.runtime.onMessage.addListener(listener);
  return () => browser.runtime.onMessage.removeListener(listener);
}
