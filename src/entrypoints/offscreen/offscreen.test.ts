import { describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  connect: vi.fn(),
  lastErrorReads: 0,
  workerPost: vi.fn(),
}));

vi.mock('webextension-polyfill', () => ({
  default: {
    runtime: {
      onConnect: { addListener: state.connect },
      get lastError() {
        state.lastErrorReads += 1;
        return { message: 'The page moved into back/forward cache' };
      },
    },
  },
}));

vi.mock('../engine/engine.worker.ts?worker', () => ({
  default: class {
    postMessage = state.workerPost;
  },
}));

describe('offscreen lifecycle', () => {
  it('releases a disconnected client and turns an unhandled rejection into status', async () => {
    await import('./offscreen');
    const onConnect = state.connect.mock.calls[0]?.[0] as (port: unknown) => void;
    let disconnect: () => void = () => {};
    const port = {
      name: 'ufeed:shared-engine',
      postMessage: vi.fn(),
      onMessage: { addListener: vi.fn() },
      onDisconnect: {
        addListener: (listener: () => void) => {
          disconnect = listener;
        },
      },
    };

    onConnect(port);
    disconnect();
    disconnect();

    expect(state.lastErrorReads).toBe(2);
    expect(state.workerPost).toHaveBeenCalledTimes(2);
    expect(state.workerPost).toHaveBeenLastCalledWith({
      type: 'RELEASE',
      clientId: 'c1',
    });

    const active = {
      name: 'ufeed:shared-engine',
      postMessage: vi.fn(),
      onMessage: { addListener: vi.fn() },
      onDisconnect: { addListener: vi.fn() },
    };
    onConnect(active);
    const rejection = new Event('unhandledrejection', { cancelable: true });
    Object.defineProperty(rejection, 'reason', { value: new Error('network error') });
    dispatchEvent(rejection);

    expect(rejection.defaultPrevented).toBe(true);
    expect(active.postMessage).toHaveBeenLastCalledWith({
      type: 'STATUS',
      state: 'error',
      message: 'network error',
    });
  });
});
