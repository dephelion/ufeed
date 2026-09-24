import EngineWorker from './engine.worker.ts?worker';
import { logger } from '../../core/log';
import { DEFAULT_MODEL, isModelKey } from '../../core/models';
import {
  ENGINE_READY,
  isEngineReply,
  isEngineRequest,
  isHandshake,
  type EngineReply,
  type InitRequest,
  type StatusEvent,
} from '../../core/protocol';

/**
 * Routes messages and nothing else. It exists because a content script cannot
 * spawn an extension-origin Worker, but a document on that origin can.
 */
const log = logger('engine');
log.info('engine starting', { origin: location.origin });

addEventListener('unhandledrejection', (event) => {
  event.preventDefault();
  log.error('unhandled rejection in engine', { reason: String(event.reason) });
});

let port: MessagePort | undefined;
let lastStatus: StatusEvent = { type: 'STATUS', state: 'idle' };

const fail = (message: string): void => {
  lastStatus = { type: 'STATUS', state: 'error', message };
  port?.postMessage(lastStatus);
};

/**
 * The content script picks the model and puts it in this frame's URL. Read here
 * rather than passed over the port: the worker must know before the first
 * request, and the host page never gets a say.
 */
const requested = new URLSearchParams(location.search).get('model');
const model = isModelKey(requested) ? requested : DEFAULT_MODEL;

let worker: Worker | undefined;
try {
  worker = new EngineWorker();
  // First message, before any port exists, so the worker cannot load without it.
  worker.postMessage({ type: 'INIT', model } satisfies InitRequest);
  log.info('worker spawned', { model });
} catch (error) {
  const reason = error instanceof Error ? error.message : String(error);
  log.error('worker could not be created', { reason });
  fail(reason);
}

if (worker) {
  worker.onmessage = (event: MessageEvent<unknown>) => {
    const reply = event.data;
    if (!isEngineReply(reply)) return;
    if (reply.type === 'STATUS') lastStatus = reply;
    port?.postMessage(reply satisfies EngineReply);
  };

  worker.onerror = (event) => {
    event.preventDefault();
    log.error('worker error', { reason: event.message });
    fail(event.message || 'worker failed to start');
  };
}

// First handshake only: the host page shares the parent window and could send a second one.
addEventListener('message', (event: MessageEvent<unknown>) => {
  if (port || !isHandshake(event.data)) return;
  port = event.ports[0];
  if (!port) return;
  port.onmessage = (request: MessageEvent<unknown>) => {
    if (isEngineRequest(request.data)) worker?.postMessage(request.data);
  };
  port.postMessage(lastStatus);
  log.info('port connected');
});

window.parent.postMessage(ENGINE_READY, '*');
