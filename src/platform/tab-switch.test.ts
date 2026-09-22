import browser from 'webextension-polyfill';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { askTabSwitch, serveTabSwitch, setTabSwitch } from './tab-switch';

describe('tab switch', () => {
  afterEach(() => vi.restoreAllMocks());

  it('reads undefined from a tab with no content script', async () => {
    vi.spyOn(browser.tabs, 'sendMessage').mockRejectedValue(new Error('no receiver'));
    expect(await askTabSwitch(7)).toBeUndefined();
    expect(await setTabSwitch(7, false)).toBeUndefined();
  });

  it('asks nobody without a tab id', async () => {
    const send = vi.spyOn(browser.tabs, 'sendMessage');
    expect(await askTabSwitch(undefined)).toBeUndefined();
    expect(send).not.toHaveBeenCalled();
  });

  it('flips only the tab it is sent to', async () => {
    const send = vi.spyOn(browser.tabs, 'sendMessage').mockResolvedValue(false);
    expect(await setTabSwitch(7, false)).toBe(false);
    expect(send).toHaveBeenCalledWith(7, { type: 'ufeed:on', on: false });
  });

  it('serves the switch and applies a flip on the content side', async () => {
    let on = true;
    const add = vi.spyOn(browser.runtime.onMessage, 'addListener');
    serveTabSwitch(
      () => on,
      (next) => (on = next),
    );
    const listener = add.mock.calls[0]?.[0] as (m: unknown) => unknown;

    expect(await listener({ type: 'ufeed:on?' })).toBe(true);
    expect(await listener({ type: 'ufeed:on', on: false })).toBe(false);
    expect(on).toBe(false);
    expect(listener({ type: 'ufeed:on', on: 'no' })).toBeUndefined();
    expect(listener({ type: 'ufeed:status?' })).toBeUndefined();
  });
});
