/**
 * The popup's on/off switch belongs to the tab on screen, like an ad blocker's:
 * turning one tab off leaves every other tab filtering. The state lives in that
 * tab's content script and nowhere else, so nothing is stored and a reload
 * turns the tab back on.
 */
import browser from 'webextension-polyfill';

const ASK = 'ufeed:on?';
const SET = 'ufeed:on';

interface Ask {
  type: typeof ASK;
}

interface Flip {
  type: typeof SET;
  on: boolean;
}

const isAsk = (m: unknown): m is Ask =>
  typeof m === 'object' && m !== null && (m as Ask).type === ASK;

const isFlip = (m: unknown): m is Flip =>
  typeof m === 'object' &&
  m !== null &&
  (m as Flip).type === SET &&
  typeof (m as Flip).on === 'boolean';

/** Content side: answer with the switch, and flip it when told. */
export function serveTabSwitch(
  current: () => boolean,
  set: (on: boolean) => void,
): () => void {
  const listener = (message: unknown) => {
    if (isAsk(message)) return Promise.resolve(current());
    if (!isFlip(message)) return undefined;
    set(message.on);
    return Promise.resolve(current());
  };
  browser.runtime.onMessage.addListener(listener);
  return () => browser.runtime.onMessage.removeListener(listener);
}

/** Popup side. Undefined when the tab runs no content script: not a feed, or not yet injected. */
export async function askTabSwitch(
  tabId: number | undefined,
): Promise<boolean | undefined> {
  if (tabId === undefined) return undefined;
  try {
    const reply: unknown = await browser.tabs.sendMessage(tabId, {
      type: ASK,
    } satisfies Ask);
    return typeof reply === 'boolean' ? reply : undefined;
  } catch {
    return undefined;
  }
}

/** Popup side. Resolves to what the tab now holds, undefined if it did not answer. */
export async function setTabSwitch(
  tabId: number,
  on: boolean,
): Promise<boolean | undefined> {
  try {
    const reply: unknown = await browser.tabs.sendMessage(tabId, {
      type: SET,
      on,
    } satisfies Flip);
    return typeof reply === 'boolean' ? reply : undefined;
  } catch {
    return undefined;
  }
}
