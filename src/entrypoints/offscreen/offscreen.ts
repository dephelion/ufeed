import browser from 'webextension-polyfill';
import EngineWorker from '../engine/engine.worker.ts?worker';
import { logger } from '../../core/log';
import {
  isEngineReply,
  isEngineRequest,
  isRoutedReply,
  SHARED_ENGINE,
  type EngineReply,
  type InitRequest,
  type StatusEvent,
} from '../../core/protocol';

const log = logger('shared-engine');
const clients = new Map<string, browser.Runtime.Port>();
let nextClient = 0;
let lastStatus: StatusEvent = { type: 'STATUS', state: 'idle' };

const release = (clientId: string): void => {
  if (!clients.has(clientId)) return;
  clients.delete(clientId);
  worker?.postMessage({ type: 'RELEASE', clientId });
};

const send = (clientId: string, reply: EngineReply): void => {
  const port = clients.get(clientId);
  if (!port) return;
  try {
    port.postMessage(reply);
  } catch {
    release(clientId);
    port.disconnect();
  }
};

const broadcast = (status: StatusEvent): void => {
  lastStatus = status;
  for (const clientId of clients.keys()) send(clientId, status);
};

addEventListener('unhandledrejection', (event) => {
  event.preventDefault();
  const reason =
    event.reason instanceof Error ? event.reason.message : String(event.reason);
  log.warn('shared engine stopped after an unhandled rejection', { reason });
  broadcast({ type: 'STATUS', state: 'error', message: reason });
});

let worker: Worker | undefined;
try {
  worker = new EngineWorker();
  worker.postMessage({ type: 'INIT', model: 'gemma', threads: 2 } satisfies InitRequest);
  worker.onmessage = (event: MessageEvent<unknown>) => {
    if (isRoutedReply(event.data)) {
      send(event.data.clientId, event.data.reply);
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
    // Chrome reports BFCache port closure through lastError; reading it handles the event.
    void browser.runtime.lastError;
    release(clientId);
  });
  send(clientId, lastStatus);
});
