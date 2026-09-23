import browser from 'webextension-polyfill';
import EngineWorker from '../engine/engine.worker.ts?worker';
import { logger } from '../../core/log';
import {
  isEngineReply,
  isEngineRequest,
  isRoutedReply,
  SHARED_ENGINE,
  type InitRequest,
  type StatusEvent,
} from '../../core/protocol';

const log = logger('shared-engine');
const clients = new Map<string, browser.Runtime.Port>();
let nextClient = 0;
let lastStatus: StatusEvent = { type: 'STATUS', state: 'idle' };

const broadcast = (status: StatusEvent): void => {
  lastStatus = status;
  for (const port of clients.values()) port.postMessage(status);
};

addEventListener('unhandledrejection', (event) => {
  event.preventDefault();
  log.error('unhandled rejection in shared engine', { reason: String(event.reason) });
});

let worker: Worker | undefined;
try {
  worker = new EngineWorker();
  worker.postMessage({ type: 'INIT', model: 'gemma', threads: 2 } satisfies InitRequest);
  worker.onmessage = (event: MessageEvent<unknown>) => {
    if (isRoutedReply(event.data)) {
      clients.get(event.data.clientId)?.postMessage(event.data.reply);
    } else if (isEngineReply(event.data) && event.data.type === 'STATUS') {
      broadcast(event.data);
    }
  };
  worker.onerror = (event) => {
    event.preventDefault();
    broadcast({ type: 'STATUS', state: 'error', message: event.message });
  };
} catch (error) {
  broadcast({
    type: 'STATUS',
    state: 'error',
    message: error instanceof Error ? error.message : String(error),
  });
}

browser.runtime.onConnect.addListener((port) => {
  if (port.name !== SHARED_ENGINE) return;
  const clientId = `c${++nextClient}`;
  clients.set(clientId, port);
  port.onMessage.addListener((request: unknown) => {
    if (isEngineRequest(request)) worker?.postMessage({ clientId, request });
  });
  port.onDisconnect.addListener(() => {
    clients.delete(clientId);
    worker?.postMessage({ type: 'RELEASE', clientId });
  });
  port.postMessage(lastStatus);
});
