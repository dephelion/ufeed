import browser from 'webextension-polyfill';
import {
  HANDSHAKE, isEngineReply, nextRequestId,
  type EngineRequest, type StatusEvent,
} from '../core/protocol';

const REQUEST_TIMEOUT_MS = 8000;

type Pending = { resolve: (scores: number[]) => void; timer: ReturnType<typeof setTimeout> };

/** Owns the hidden extension-origin iframe and the private port into it. */
export class EngineClient {
  #port: MessagePort | undefined;
  #frame: HTMLIFrameElement | undefined;
  readonly #pending = new Map<string, Pending>();
  #status: StatusEvent = { type: 'STATUS', state: 'idle' };

  constructor(private readonly onStatus: (status: StatusEvent) => void) {}

  get status(): StatusEvent {
    return this.#status;
  }

  get ready(): boolean {
    return this.#status.state === 'ready';
  }

  connect(): void {
    if (this.#frame) return;
    const frame = document.createElement('iframe');
    frame.src = browser.runtime.getURL('engine.html');
    frame.allow = 'webgpu';
    frame.setAttribute('aria-hidden', 'true');
    frame.setAttribute('tabindex', '-1');
    frame.style.cssText =
      'position:fixed;width:0;height:0;border:0;opacity:0;pointer-events:none;left:-9999px';
    frame.addEventListener('load', () => this.#handshake(frame));
    document.documentElement.appendChild(frame);
    this.#frame = frame;
  }

  #handshake(frame: HTMLIFrameElement): void {
    const channel = new MessageChannel();
    this.#port = channel.port1;
    channel.port1.onmessage = (event: MessageEvent<unknown>) => this.#receive(event.data);
    channel.port1.start();
    frame.contentWindow?.postMessage({ type: HANDSHAKE }, '*', [channel.port2]);
  }

  #receive(data: unknown): void {
    if (!isEngineReply(data)) return;
    if (data.type === 'STATUS') {
      this.#status = data;
      this.onStatus(data);
      return;
    }
    const pending = this.#pending.get(data.id);
    if (!pending) return;
    this.#pending.delete(data.id);
    clearTimeout(pending.timer);
    pending.resolve(data.type === 'SCORES' ? data.scores : []);
  }

  setTopics(topics: string[]): void {
    this.#send({ id: nextRequestId(), type: 'SET_TOPICS', topics });
  }

  /** Resolves empty on timeout or error, so callers fail open. */
  score(texts: string[]): Promise<number[]> {
    if (texts.length === 0) return Promise.resolve([]);
    const id = nextRequestId();
    return new Promise<number[]>((resolve) => {
      const timer = setTimeout(() => {
        this.#pending.delete(id);
        resolve([]);
      }, REQUEST_TIMEOUT_MS);
      this.#pending.set(id, { resolve, timer });
      this.#send({ id, type: 'SCORE', texts });
    });
  }

  #send(request: EngineRequest): void {
    this.#port?.postMessage(request);
  }
}
