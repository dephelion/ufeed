import EngineWorker from './engine.worker.ts?worker';
import {
  HANDSHAKE, isEngineReply, isEngineRequest,
  type EngineReply, type StatusEvent,
} from '../../core/protocol';

/**
 * Routes messages and nothing else. It exists because a content script cannot
 * spawn an extension-origin Worker, but a document on that origin can.
 */
const worker = new EngineWorker();

let port: MessagePort | undefined;
let lastStatus: StatusEvent = { type: 'STATUS', state: 'idle' };

worker.onmessage = (event: MessageEvent<unknown>) => {
  const reply = event.data;
  if (!isEngineReply(reply)) return;
  if (reply.type === 'STATUS') lastStatus = reply;
  port?.postMessage(reply satisfies EngineReply);
};

worker.onerror = (event) => {
  const status: StatusEvent = {
    type: 'STATUS',
    state: 'error',
    message: event.message || 'worker failed to start',
  };
  lastStatus = status;
  port?.postMessage(status);
};

addEventListener('message', (event: MessageEvent<unknown>) => {
  const data = event.data as { type?: unknown } | null;
  if (!data || data.type !== HANDSHAKE) return;
  port = event.ports[0];
  if (!port) return;
  port.onmessage = (request: MessageEvent<unknown>) => {
    if (isEngineRequest(request.data)) worker.postMessage(request.data);
  };
  port.postMessage(lastStatus);
});
