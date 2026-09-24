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

describe('offscreen port lifecycle', () => {
  it('consumes a BFCache disconnect error and releases the worker client once', async () => {
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
  });
});
