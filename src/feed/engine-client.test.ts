import { describe, expect, it, vi } from 'vitest';

const EXTENSION = 'chrome-extension://feedlens/';

vi.mock('webextension-polyfill', () => ({
  default: {
    runtime: { getURL: (path: string) => (path === '/' ? EXTENSION : 'about:blank') },
  },
}));

const { EngineClient } = await import('./engine-client');
const { HANDSHAKE } = await import('../core/protocol');

describe('the engine handshake', () => {
  it('offers the port to the extension origin only, never to whatever the frame shows', () => {
    const client = new EngineClient(() => {});
    client.connect();
    const frame = document.querySelector('iframe')!;
    const postMessage = vi.fn();
    Object.defineProperty(frame, 'contentWindow', { value: { postMessage } });

    frame.dispatchEvent(new Event('load'));

    expect(postMessage).toHaveBeenCalledWith({ type: HANDSHAKE }, EXTENSION, [
      expect.anything(),
    ]);
  });
});
