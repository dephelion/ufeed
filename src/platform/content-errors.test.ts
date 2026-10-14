import { describe, expect, it, vi } from 'vitest';
import browser from 'webextension-polyfill';

const state = vi.hoisted(() => ({
  publish: vi.fn(),
  current: undefined as (() => { state: string }) | undefined,
}));

vi.mock('wxt/utils/define-content-script', () => ({
  defineContentScript: (options: unknown) => options,
}));
vi.mock('../adapters', () => ({ adapterFor: () => ({ id: 'reddit' }) }));
vi.mock('../platform/storage', () => ({
  loadSettings: () => new Promise(() => {}),
}));
vi.mock('../platform/status-channel', () => ({
  serveEngineStatus: (current: () => { state: string }) => {
    state.current = current;
  },
  publishEngineStatus: state.publish,
  publishFeedDetected: vi.fn(),
}));

describe('content error ownership', () => {
  it('does not mistake a host page rejection for a failed engine', async () => {
    const { default: script } = await import('../entrypoints/content');
    Object.defineProperty(window, 'location', {
      value: { hostname: 'www.reddit.com' },
      configurable: true,
    });
    script.main({} as NonNullable<Parameters<typeof script.main>[0]>);

    const rejection = new Event('unhandledrejection', { cancelable: true });
    Object.defineProperty(rejection, 'reason', {
      value: new TypeError(
        'error loading dynamically imported module: https://www.redditstatic.com/shreddit/sentry.js',
      ),
    });
    dispatchEvent(rejection);

    expect(rejection.defaultPrevented).toBe(false);
    expect(state.current?.()).toEqual({ state: 'idle' });
    expect(state.publish).not.toHaveBeenCalled();

    dispatchEvent(
      new ErrorEvent('error', {
        filename: browser.runtime.getURL('/content.js'),
        error: new Error('extension fault'),
      }),
    );
    expect(state.current?.()).toEqual({ state: 'error', message: 'extension fault' });
    expect(state.publish).toHaveBeenCalledWith({
      state: 'error',
      message: 'extension fault',
    });
  });
});
