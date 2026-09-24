import { afterEach, describe, expect, it, vi } from 'vitest';

const EXTENSION = 'chrome-extension://ufeed/';

vi.mock('webextension-polyfill', () => ({
  default: {
    runtime: { getURL: (path: string) => (path === '/' ? EXTENSION : 'about:blank') },
  },
}));

const { EngineClient } = await import('./engine-client');
const { ENGINE_READY, HANDSHAKE } = await import('../core/protocol');

afterEach(() => {
  document.querySelectorAll('iframe').forEach((frame) => frame.remove());
  vi.unstubAllGlobals();
});

describe('the engine handshake', () => {
  it('offers the port to the extension origin only, never to whatever the frame shows', () => {
    const client = new EngineClient();
    client.connect('e5-small');
    const frame = document.querySelector('iframe')!;
    const postMessage = vi.fn();
    Object.defineProperty(frame, 'contentWindow', { value: { postMessage } });

    frame.dispatchEvent(new Event('load'));
    dispatchEvent(new MessageEvent('message', { data: ENGINE_READY, origin: 'null' }));
    expect(postMessage).not.toHaveBeenCalled();

    dispatchEvent(
      new MessageEvent('message', {
        data: ENGINE_READY,
        origin: 'chrome-extension://ufeed',
      }),
    );

    expect(postMessage).toHaveBeenCalledWith({ type: HANDSHAKE }, EXTENSION, [
      expect.anything(),
    ]);
  });

  it('keeps requests buffered if navigation changes the frame during the handshake', () => {
    const posted = vi.fn();
    vi.stubGlobal(
      'MessageChannel',
      class {
        port1 = { postMessage: posted, start: () => {}, close: () => {} };
        port2 = { close: () => {} };
      },
    );
    const client = new EngineClient();
    client.connect('e5-small');
    client.setTopics(['programming']);
    const frame = document.querySelector('iframe')!;
    const postMessage = vi.fn().mockImplementationOnce(() => {
      throw new DOMException('target origin does not match', 'SecurityError');
    });
    Object.defineProperty(frame, 'contentWindow', { value: { postMessage } });

    expect(() =>
      dispatchEvent(
        new MessageEvent('message', {
          data: ENGINE_READY,
          origin: 'chrome-extension://ufeed',
        }),
      ),
    ).not.toThrow();
    expect(client.status.state).toBe('idle');
    expect(postMessage).toHaveBeenCalledOnce();
    expect(posted).not.toHaveBeenCalled();

    dispatchEvent(
      new MessageEvent('message', {
        data: ENGINE_READY,
        origin: 'chrome-extension://ufeed',
      }),
    );
    expect(posted).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'SET_TOPICS', topics: ['programming'] }),
    );
  });
});
