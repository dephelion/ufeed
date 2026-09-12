import browser from 'webextension-polyfill';
import { EMPTY_FEEDBACK, type Feedback } from './feedback';

const KEY = 'feedback';

export async function loadFeedback(): Promise<Feedback> {
  const stored = await browser.storage.local.get(KEY);
  return { ...EMPTY_FEEDBACK, ...(stored[KEY] as Partial<Feedback> | undefined) };
}

export async function saveFeedback(next: Feedback): Promise<void> {
  await browser.storage.local.set({ [KEY]: next });
}

export async function clearFeedback(): Promise<void> {
  await browser.storage.local.remove(KEY);
}
