import browser from 'webextension-polyfill';
import { logger } from '../core/log';
import type { ModelKey } from '../core/models';
import {
  ENSURE_OFFSCREEN,
  HANDSHAKE,
  isEngineReply,
  nextRequestId,
  SHARED_ENGINE,
  type EngineRequest,
  type StatusEvent,
  type TopicCorrections,
} from '../core/protocol';
import type { RatedMatch } from '../core/scoring';
import type { Correction, Engine } from '../feed/ports';

const REQUEST_TIMEOUT_MS = 8000;
const CONNECT_WATCHDOG_MS = 15000;
const SHARED_CONNECT_TIMEOUT_MS = 5000;

const log = logger('client');

/** What a reply can carry. Each caller maps it to its own shape. */
interface Payload {
  matches?: RatedMatch[];
  vector?: number[];
  topic?: number;
}

type Pending = {
  resolve: (value: Payload) => void;
  timer: ReturnType<typeof setTimeout>;
};

/** Connects this tab to an extension-origin engine and owns its pending requests. */
export class EngineClient implements Engine {
  #port: MessagePort | undefined;
  #shared: browser.Runtime.Port | undefined;
  #frame: HTMLIFrameElement | undefined;
  #connecting = false;
  #generation = 0;
  #lastTopics: EngineRequest | undefined;
  #extension = '';
  readonly #pending = new Map<string, Pending>();
  readonly #outbox: EngineRequest[] = [];
  #status: StatusEvent = { type: 'STATUS', state: 'idle' };
  #busy = true;
  #onBusy: (busy: boolean) => void = () => {};
  #onStatus: (status: StatusEvent) => void = () => {};

  onStatus(fn: (status: StatusEvent) => void): void {
    this.#onStatus = fn;
  }

  /** Not ready, or a request is waiting on the worker. A thumb sent now would queue behind it. */
  get busy(): boolean {
    return this.#busy;
  }

  onBusyChange(fn: (busy: boolean) => void): void {
    this.#onBusy = fn;
    fn(this.#busy);
  }

  #updateBusy(): void {
    const busy = !this.ready || this.#pending.size > 0;
    if (busy === this.#busy) return;
    this.#busy = busy;
    this.#onBusy(busy);
  }

  get status(): StatusEvent {
    return this.#status;
  }

  get ready(): boolean {
    return this.#status.state === 'ready';
  }

  /**
   * Replaces this tab's connection on a model switch. A worker loads one model
   * for its whole life; anything in flight would answer in the old score space.
   */
  restart(model: ModelKey): void {
    this.#generation += 1;
    this.#connecting = false;
    for (const [id, pending] of this.#pending) {
      clearTimeout(pending.timer);
      log.info('dropping request, engine restarting', { id });
      pending.resolve({});
    }
    this.#pending.clear();
    this.#outbox.length = 0;
    this.#port?.close();
    this.#port = undefined;
    const shared = this.#shared;
    this.#shared = undefined;
    shared?.disconnect();
    this.#frame?.remove();
    this.#frame = undefined;
    this.#lastTopics = undefined;
    this.#status = { type: 'STATUS', state: 'idle' };
    this.#onStatus(this.#status);
    this.#updateBusy();
    this.connect(model);
  }

  connect(model: ModelKey): void {
    if (this.#frame || this.#shared || this.#connecting) return;
    if (
      model === 'gemma' &&
      browser.runtime.getURL('/').startsWith('chrome-extension:')
    ) {
      void this.#connectShared();
      return;
    }
    this.#connectFrame(model);
  }

  async #connectShared(): Promise<void> {
    const generation = ++this.#generation;
    this.#connecting = true;
    try {
      let timer: ReturnType<typeof setTimeout> | undefined;
      const availability = browser.runtime.sendMessage({ type: ENSURE_OFFSCREEN });
      const timeout = new Promise<false>((resolve) => {
        timer = setTimeout(() => resolve(false), SHARED_CONNECT_TIMEOUT_MS);
      });
      const available = await Promise.race([availability, timeout]).finally(() =>
        clearTimeout(timer),
      );
      if (available !== true) throw new Error('offscreen document unavailable');
      if (generation !== this.#generation) return;
      const port = browser.runtime.connect({ name: SHARED_ENGINE });
      this.#shared = port;
      let reported = false;
      const watchdog = setTimeout(() => {
        if (!reported && this.#shared === port) this.#fallBackToFrame();
      }, 1500);
      port.onMessage.addListener((data: unknown) => {
        if (this.#shared !== port) return;
        reported = true;
        clearTimeout(watchdog);
        if (isEngineReply(data) && data.type === 'STATUS' && data.state === 'error') {
          this.#fallBackToFrame();
          return;
        }
        this.#receive(data);
      });
      port.onDisconnect.addListener(() => {
        void browser.runtime.lastError;
        clearTimeout(watchdog);
        if (this.#shared === port) this.#fallBackToFrame();
      });
      for (const request of this.#outbox.splice(0)) port.postMessage(request);
    } catch (error) {
      if (generation !== this.#generation) return;
      log.warn('shared engine unavailable, using iframe', {
        reason: error instanceof Error ? error.message : String(error),
      });
      this.#fallBackToFrame();
    } finally {
      if (generation === this.#generation) this.#connecting = false;
    }
  }

  #fallBackToFrame(): void {
    this.#generation += 1;
    this.#connecting = false;
    const shared = this.#shared;
    this.#shared = undefined;
    shared?.disconnect();
    for (const pending of this.#pending.values()) {
      clearTimeout(pending.timer);
      pending.resolve({});
    }
    this.#pending.clear();
    this.#outbox.length = 0;
    if (this.#lastTopics) this.#outbox.push(this.#lastTopics);
    this.#status = { type: 'STATUS', state: 'idle' };
    this.#onStatus(this.#status);
    this.#updateBusy();
    this.#connectFrame('gemma');
  }

  #connectFrame(model: ModelKey): void {
    const frame = document.createElement('iframe');
    this.#extension = browser.runtime.getURL('/');
    // The model rides in the URL: the worker has to know it before the first
    // request, and a frame per model keeps one model per worker.
    frame.src = `${browser.runtime.getURL('engine.html')}?model=${encodeURIComponent(model)}`;
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
    if (frame !== this.#frame) return;
    this.#port?.close();
    const channel = new MessageChannel();
    this.#port = channel.port1;
    channel.port1.onmessage = (event: MessageEvent<unknown>) => {
      if (this.#port === channel.port1) this.#receive(event.data);
    };
    channel.port1.start();
    // The frame sits in the host DOM: a page that navigates it must not receive the port.
    frame.contentWindow?.postMessage({ type: HANDSHAKE }, this.#extension, [
      channel.port2,
    ]);
    log.info('handshake sent', { buffered: this.#outbox.length });
    for (const request of this.#outbox.splice(0)) channel.port1.postMessage(request);
  }

  #receive(data: unknown): void {
    if (!isEngineReply(data)) return;
    if (data.type === 'STATUS') {
      if (data.state !== this.#status.state) {
        log.info('engine status', { state: data.state, reason: data.message });
      }
      this.#status = data;
      this.#onStatus(data);
      this.#updateBusy();
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
    this.#updateBusy();
    if (data.type === 'ERROR') {
      log.warn('engine returned an error, revealing batch', { reason: data.message });
      pending.resolve({});
      return;
    }
    if (data.type === 'VECTOR')
      return pending.resolve({ vector: data.vector, topic: data.topic });
    if (data.type === 'SCORES')
      return pending.resolve({
        matches: data.scores.map((score, i) => ({
          score,
          topic: data.topics[i]!,
          lines: data.lines[i]!,
          rating: data.ratings[i] ?? undefined,
        })),
      });
    pending.resolve({});
  }

  setTopics(topics: string[], corrections: TopicCorrections[] = []): void {
    const request = {
      id: nextRequestId(),
      type: 'SET_TOPICS',
      topics,
      corrections,
    } as const;
    this.#lastTopics = request;
    this.#send(request);
  }

  score(texts: string[]): Promise<RatedMatch[]> {
    if (texts.length === 0) return Promise.resolve([]);
    const id = nextRequestId();
    return new Promise<RatedMatch[]>((resolve) => {
      const timer = setTimeout(() => {
        this.#pending.delete(id);
        this.#updateBusy();
        log.warn('score request timed out, revealing', { posts: texts.length });
        resolve([]);
      }, REQUEST_TIMEOUT_MS);
      this.#pending.set(id, { resolve: (p) => resolve(p.matches ?? []), timer });
      this.#updateBusy();
      this.#send({ id, type: 'SCORE', texts });
    });
  }

  feedback(text: string, liked: boolean): Promise<Correction> {
    const id = nextRequestId();
    return new Promise<Correction>((resolve) => {
      const timer = setTimeout(() => {
        this.#pending.delete(id);
        this.#updateBusy();
        log.warn('feedback request timed out');
        resolve({ vector: [], topic: -1 });
      }, REQUEST_TIMEOUT_MS);
      this.#pending.set(id, {
        resolve: (p) => resolve({ vector: p.vector ?? [], topic: p.topic ?? -1 }),
        timer,
      });
      this.#updateBusy();
      this.#send({ id, type: 'FEEDBACK', text, liked });
    });
  }

  /** Buffers until the selected engine transport opens. */
  #send(request: EngineRequest): void {
    if (this.#shared) this.#shared.postMessage(request);
    else if (this.#port) this.#port.postMessage(request);
    else this.#outbox.push(request);
  }
}
