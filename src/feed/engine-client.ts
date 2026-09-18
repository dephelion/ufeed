import browser from 'webextension-polyfill';
import { logger } from '../core/log';
import {
  HANDSHAKE,
  isEngineReply,
  nextRequestId,
  type EngineRequest,
  type StatusEvent,
  type TopicCorrections,
} from '../core/protocol';
import type { Match } from '../ml/scoring';

const REQUEST_TIMEOUT_MS = 8000;
const CONNECT_WATCHDOG_MS = 15000;

const log = logger('client');

/** A correction with the topic line it belongs to; topic -1 means nowhere to file it. */
export interface Correction {
  vector: number[];
  topic: number;
}

/** What a reply can carry. Each caller maps it to its own shape. */
interface Payload {
  matches?: Match[];
  vector?: number[];
  topic?: number;
}

type Pending = {
  resolve: (value: Payload) => void;
  timer: ReturnType<typeof setTimeout>;
};

/** Owns the hidden extension-origin iframe and the private port into it. */
export class EngineClient {
  #port: MessagePort | undefined;
  #frame: HTMLIFrameElement | undefined;
  readonly #pending = new Map<string, Pending>();
  readonly #outbox: EngineRequest[] = [];
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
    frame.setAttribute('aria-hidden', 'true');
    frame.setAttribute('tabindex', '-1');
    frame.style.cssText =
      'position:fixed;width:0;height:0;border:0;opacity:0;pointer-events:none;left:-9999px';
    frame.addEventListener('load', () => this.#handshake(frame));
    frame.addEventListener('error', () => log.warn('engine iframe failed to load'));
    log.info('injecting engine iframe', { src: frame.src });
    document.documentElement.appendChild(frame);
    this.#frame = frame;

    setTimeout(() => {
      if (this.#status.state === 'idle') {
        log.warn('engine never reported in; check the engine.html frame console', {
          framed: frame.isConnected,
          port: this.#port !== undefined,
          buffered: this.#outbox.length,
        });
      }
    }, CONNECT_WATCHDOG_MS);
  }

  #handshake(frame: HTMLIFrameElement): void {
    const channel = new MessageChannel();
    this.#port = channel.port1;
    channel.port1.onmessage = (event: MessageEvent<unknown>) => this.#receive(event.data);
    channel.port1.start();
    frame.contentWindow?.postMessage({ type: HANDSHAKE }, '*', [channel.port2]);
    log.info('handshake sent', { buffered: this.#outbox.length });
    for (const request of this.#outbox.splice(0)) channel.port1.postMessage(request);
  }

  #receive(data: unknown): void {
    if (!isEngineReply(data)) return;
    if (data.type === 'STATUS') {
      if (data.state !== this.#status.state) {
        log.info('engine status', {
          state: data.state,
          backend: data.backend,
          reason: data.message,
        });
      }
      this.#status = data;
      this.onStatus(data);
      return;
    }
    if (data.type === 'ACK') return;
    const pending = this.#pending.get(data.id);
    if (!pending) {
      log.info('late reply, request already timed out', { id: data.id, type: data.type });
      return;
    }
    this.#pending.delete(data.id);
    clearTimeout(pending.timer);
    if (data.type === 'ERROR') {
      log.warn('engine returned an error, revealing batch', { reason: data.message });
      pending.resolve({});
      return;
    }
    if (data.type === 'VECTOR')
      return pending.resolve({ vector: data.vector, topic: data.topic });
    if (data.type === 'SCORES')
      return pending.resolve({
        matches: data.scores.map((score, i) => ({ score, topic: data.topics[i]! })),
      });
    pending.resolve({});
  }

  setTopics(topics: string[], corrections: TopicCorrections[] = []): void {
    this.#send({ id: nextRequestId(), type: 'SET_TOPICS', topics, corrections });
  }

  /** Resolves empty on timeout or error, so callers fail open. */
  score(texts: string[]): Promise<Match[]> {
    if (texts.length === 0) return Promise.resolve([]);
    const id = nextRequestId();
    return new Promise<Match[]>((resolve) => {
      const timer = setTimeout(() => {
        this.#pending.delete(id);
        log.warn('score request timed out, revealing', { posts: texts.length });
        resolve([]);
      }, REQUEST_TIMEOUT_MS);
      this.#pending.set(id, { resolve: (p) => resolve(p.matches ?? []), timer });
      this.#send({ id, type: 'SCORE', texts });
    });
  }

  /** Resolves empty when the engine cannot answer, so feedback is dropped, never guessed. */
  feedback(text: string, liked: boolean): Promise<Correction> {
    const id = nextRequestId();
    return new Promise<Correction>((resolve) => {
      const timer = setTimeout(() => {
        this.#pending.delete(id);
        log.warn('feedback request timed out');
        resolve({ vector: [], topic: -1 });
      }, REQUEST_TIMEOUT_MS);
      this.#pending.set(id, {
        resolve: (p) => resolve({ vector: p.vector ?? [], topic: p.topic ?? -1 }),
        timer,
      });
      this.#send({ id, type: 'FEEDBACK', text, liked });
    });
  }

  /** Buffers until the iframe finishes loading; connect() only starts that. */
  #send(request: EngineRequest): void {
    if (this.#port) this.#port.postMessage(request);
    else this.#outbox.push(request);
  }
}
