/**
 * How an engine state reads. The popup asks the tab on screen for this over
 * status-channel.ts and holds it in memory only — nothing here is stored, so
 * there is no record of when a feed was last open.
 *
 * Never carries post text. State, backend, a percentage and a failure reason.
 */
import type { Backend, EngineState, StatusEvent } from './protocol';

export interface EngineStatus {
  state: EngineState;
  backend?: Backend;
  /** Per-file download percentage, 0-100. Rounded; transformers.js reports floats. */
  progress?: number;
  message?: string;
}

/** How the footer light reads. Downloading and warming are both "working on it". */
export type StatusTone = 'idle' | 'busy' | 'ready' | 'error';

export function toStatus(event: StatusEvent): EngineStatus {
  return {
    state: event.state,
    backend: event.backend,
    progress: event.progress === undefined ? undefined : Math.round(event.progress),
    message: event.message,
  };
}

/**
 * Download progress arrives per file and several times a second. Broadcasting
 * each one would jitter a number nobody can read that fast, so a report needs
 * either a new state or a percentage that moved a visible amount.
 */
const PROGRESS_STEP = 5;

export function worthReporting(
  previous: EngineStatus | undefined,
  next: EngineStatus,
): boolean {
  if (!previous) return true;
  if (previous.state !== next.state) return true;
  if (previous.backend !== next.backend) return true;
  if (previous.message !== next.message) return true;
  if (next.progress === undefined) return previous.progress !== undefined;
  if (previous.progress === undefined) return true;
  return Math.abs(next.progress - previous.progress) >= PROGRESS_STEP;
}

/**
 * The header chip. The popup runs past Chrome's 600px cap, so the footer opens
 * below the fold — this is the only engine state a reader sees without
 * scrolling, and it has to share a 380px row with the title and the switch.
 * Hence two or three words, and the sentence left to `describeEngine`.
 */
export function summarizeEngine(status: EngineStatus | undefined): {
  tone: StatusTone;
  text: string;
} {
  if (!status) return { tone: 'idle', text: 'No feed here' };
  switch (status.state) {
    case 'idle':
      return { tone: 'idle', text: 'Not started' };
    case 'downloading':
      return {
        tone: 'busy',
        text:
          status.progress === undefined
            ? 'Downloading'
            : `Downloading ${status.progress}%`,
      };
    case 'warming':
      return { tone: 'busy', text: 'Checking' };
    case 'ready':
      return {
        tone: 'ready',
        text: status.backend ? `Ready · ${status.backend}` : 'Ready',
      };
    case 'error':
      return { tone: 'error', text: 'Failed' };
  }
}

/**
 * Plain language, and honest about the one slow step: the model is a real
 * download and a reader who is not told that reads the silence as a bug.
 */
export function describeEngine(status: EngineStatus | undefined): {
  tone: StatusTone;
  text: string;
} {
  if (!status) {
    return {
      tone: 'idle',
      text: 'No engine on this tab — open x, LinkedIn or Reddit',
    };
  }
  switch (status.state) {
    case 'idle':
      return { tone: 'idle', text: 'Engine has not started on this tab yet' };
    case 'downloading':
      return {
        tone: 'busy',
        text:
          status.progress === undefined
            ? 'Downloading the model — one time, then it is cached'
            : `Downloading the model — ${status.progress}%, one time only`,
      };
    case 'warming':
      return { tone: 'busy', text: 'Checking the model before trusting it' };
    case 'ready':
      return {
        tone: 'ready',
        text: status.backend
          ? `Model ready, running on ${status.backend}`
          : 'Model ready',
      };
    case 'error':
      return {
        tone: 'error',
        text: status.message
          ? `Model failed to load — ${status.message}`
          : 'Model failed to load',
      };
  }
}
