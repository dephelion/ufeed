import { afterEach, describe, expect, it, vi } from 'vitest';
import { ENGINE_READY } from '../core/protocol';

const sendMessage = vi.hoisted(() => vi.fn());
const connect = vi.hoisted(() => vi.fn());

vi.mock('webextension-polyfill', () => ({
  default: {
    runtime: {
      getURL: (path: string) =>
        path === '/' ? 'chrome-extension://ufeed/' : 'about:blank',
      sendMessage,
      connect,
    },
  },
}));

const { EngineClient } = await import('./engine-client');

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  sendMessage.mockReset();
  connect.mockReset();
  document.querySelectorAll('iframe').forEach((frame) => frame.remove());
});

describe('Chrome shared engine fallback', () => {
  it('reveals an in-flight score and restores topics to the iframe when offscreen creation fails', async () => {
    sendMessage.mockResolvedValue(false);
    const posted = vi.fn();
    vi.stubGlobal(
      'MessageChannel',
      class {
        port1 = { postMessage: posted, start: () => {}, close: () => {} };
        port2 = {};
      },
    );
    const client = new EngineClient();
    client.connect('gemma');
    client.setTopics(['software']);
    const score = client.score(['a post']);

    expect(await score).toEqual([]);
    expect(document.querySelector('iframe')?.src).toContain('model=gemma');

    const frame = document.querySelector('iframe')!;
    Object.defineProperty(frame, 'contentWindow', {
      value: { postMessage: vi.fn() },
    });
    dispatchEvent(
      new MessageEvent('message', {
        data: ENGINE_READY,
        origin: 'chrome-extension://ufeed',
      }),
    );

    expect(posted).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'SET_TOPICS', topics: ['software'] }),
    );
  });

  it('falls back if creating the offscreen document never answers', async () => {
    vi.useFakeTimers();
    sendMessage.mockReturnValue(new Promise(() => {}));
    const client = new EngineClient();
    client.connect('gemma');
    client.setTopics(['software']);

    await vi.advanceTimersByTimeAsync(5000);

    expect(document.querySelector('iframe')?.src).toContain('model=gemma');
  });

  it('ignores a late offscreen answer after switching to e5', async () => {
    let answer: (available: boolean) => void = () => {};
    sendMessage.mockReturnValue(
      new Promise<boolean>((resolve) => {
        answer = resolve;
      }),
    );
    const client = new EngineClient();
    client.connect('gemma');
    client.restart('e5-small');
    Object.defineProperty(document.querySelector('iframe'), 'contentWindow', {
      value: { postMessage: vi.fn() },
    });

    answer(true);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(connect).not.toHaveBeenCalled();
    expect(document.querySelectorAll('iframe')).toHaveLength(1);
    expect(document.querySelector('iframe')?.src).toContain('model=e5-small');
  });

  it("reveals pending work and keeps this tab's topics after a shared port disconnects", async () => {
    sendMessage.mockResolvedValue(true);
    let receive: (data: unknown) => void = () => {};
    let disconnected: () => void = () => {};
    const port = {
      postMessage: vi.fn(),
      disconnect: vi.fn(),
      onMessage: { addListener: (fn: typeof receive) => (receive = fn) },
      onDisconnect: { addListener: (fn: typeof disconnected) => (disconnected = fn) },
    };
    connect.mockReturnValue(port);
    const client = new EngineClient();
    client.connect('gemma');
    client.setTopics(['software']);
    await new Promise((resolve) => setTimeout(resolve, 0));
    receive({ type: 'STATUS', state: 'ready' });
    const score = client.score(['a post']);

    disconnected();

    expect(await score).toEqual([]);
    expect(port.disconnect).toHaveBeenCalled();
    expect(document.querySelector('iframe')?.src).toContain('model=gemma');
  });

  it('falls back when the shared worker reports a model load error', async () => {
    sendMessage.mockResolvedValue(true);
    let receive: (data: unknown) => void = () => {};
    const port = {
      postMessage: vi.fn(),
      disconnect: vi.fn(),
      onMessage: { addListener: (fn: typeof receive) => (receive = fn) },
      onDisconnect: { addListener: vi.fn() },
    };
    connect.mockReturnValue(port);
    const client = new EngineClient();
    client.connect('gemma');
    client.setTopics(['software']);
    await new Promise((resolve) => setTimeout(resolve, 0));

    receive({ type: 'STATUS', state: 'error', message: 'load failed' });

    expect(port.disconnect).toHaveBeenCalled();
    expect(document.querySelector('iframe')?.src).toContain('model=gemma');
  });
});
