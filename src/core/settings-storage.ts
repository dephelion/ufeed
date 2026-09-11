import browser from 'webextension-polyfill';
import { type Settings, withDefaults } from './settings';

const KEY = 'settings';

export async function loadSettings(): Promise<Settings> {
  const stored = await browser.storage.local.get(KEY);
  return withDefaults(stored[KEY] as Partial<Settings> | undefined);
}

export async function saveSettings(patch: Partial<Settings>): Promise<Settings> {
  const next = { ...(await loadSettings()), ...patch };
  await browser.storage.local.set({ [KEY]: next });
  return next;
}

export function onSettingsChanged(fn: (settings: Settings) => void): () => void {
  const listener = (
    changes: Record<string, browser.Storage.StorageChange>,
    area: string,
  ) => {
    if (area !== 'local' || !changes[KEY]) return;
    fn(withDefaults(changes[KEY].newValue as Partial<Settings> | undefined));
  };
  browser.storage.onChanged.addListener(listener);
  return () => browser.storage.onChanged.removeListener(listener);
}
