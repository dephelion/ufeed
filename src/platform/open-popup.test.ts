import browser from 'webextension-polyfill';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { requestPopup } from './open-popup';

describe('requestPopup', () => {
  afterEach(() => vi.restoreAllMocks());

  it('sends the open message', () => {
    const send = vi.spyOn(browser.runtime, 'sendMessage').mockResolvedValue(undefined);
    requestPopup();
    expect(send).toHaveBeenCalledWith({ type: 'feedlens:open-popup' });
  });

  it('drops a rejection', async () => {
    vi.spyOn(browser.runtime, 'sendMessage').mockRejectedValue(new Error('no receiver'));
    expect(() => requestPopup()).not.toThrow();
    await Promise.resolve();
  });

  it('drops the throw an orphaned script gets after an extension reload', () => {
    vi.spyOn(browser.runtime, 'sendMessage').mockImplementation(() => {
      throw new Error('Extension context invalidated.');
    });
    expect(() => requestPopup()).not.toThrow();
  });
});
