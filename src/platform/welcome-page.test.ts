import browser from 'webextension-polyfill';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { openWelcomeOnInstall } from './welcome-page';

describe('openWelcomeOnInstall', () => {
  afterEach(() => vi.restoreAllMocks());

  it('opens the localized welcome route after a first install', () => {
    const createTab = vi
      .spyOn(browser.tabs, 'create')
      .mockResolvedValue({} as browser.Tabs.Tab);

    openWelcomeOnInstall('install');

    expect(createTab).toHaveBeenCalledWith({ url: 'https://ufeed.es/welcome/' });
  });

  it('does not reopen the welcome page on extension updates', () => {
    const createTab = vi
      .spyOn(browser.tabs, 'create')
      .mockResolvedValue({} as browser.Tabs.Tab);

    openWelcomeOnInstall('update');

    expect(createTab).not.toHaveBeenCalled();
  });

  it('handles a failure to open the welcome page', async () => {
    const createTab = vi
      .spyOn(browser.tabs, 'create')
      .mockRejectedValue(new Error('tabs unavailable'));

    expect(() => openWelcomeOnInstall('install')).not.toThrow();
    await Promise.resolve();
    expect(createTab).toHaveBeenCalledOnce();
  });
});
