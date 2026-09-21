/**
 * How an engine state reads. The popup asks the tab on screen for this over
 * status-channel.ts and holds it in memory only — nothing here is stored, so
 * there is no record of when a feed was last open.
 *
 * Never carries post text. State, a percentage and a failure reason.
 */
import type { Translate } from './messages';
import type { EngineState, StatusEvent } from './protocol';

export interface EngineStatus {
  state: EngineState;
  /** Per-file download percentage, 0-100. Rounded; transformers.js reports floats. */
  progress?: number;
  message?: string;
}

/** How the footer light reads. Downloading and warming are both "working on it". */
export type StatusTone = 'idle' | 'busy' | 'ready' | 'error';

export function toStatus(event: StatusEvent): EngineStatus {
  return {
    state: event.state,
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
export function summarizeEngine(
  status: EngineStatus | undefined,
  t: Translate,
): {
  tone: StatusTone;
  text: string;
} {
  if (!status) return { tone: 'idle', text: t('chipNone') };
  switch (status.state) {
    case 'idle':
      return { tone: 'idle', text: t('chipIdle') };
    case 'downloading':
      return {
        tone: 'busy',
        text:
          status.progress === undefined
            ? t('chipDownloading')
            : t('chipDownloadingPercent', String(status.progress)),
      };
    case 'warming':
      return { tone: 'busy', text: t('chipStarting') };
    case 'ready':
      return { tone: 'ready', text: t('chipReady') };
    case 'error':
      return { tone: 'error', text: t('chipFailed') };
  }
}

/**
 * Plain language, and honest about the one slow step: the model is a real
 * download and a reader who is not told that reads the silence as a bug.
 */
export function describeEngine(
  status: EngineStatus | undefined,
  t: Translate,
): {
  tone: StatusTone;
  text: string;
} {
  if (!status) return { tone: 'idle', text: t('engineNone') };
  switch (status.state) {
    case 'idle':
      return { tone: 'idle', text: t('engineIdle') };
    case 'downloading':
      return {
        tone: 'busy',
        text:
          status.progress === undefined
            ? t('engineDownloading')
            : t('engineDownloadingPercent', String(status.progress)),
      };
    case 'warming':
      // Also the whole of a cached load: reading ~200MB off disk and starting a
      // session is not instant, and it is emphatically not a second download.
      return { tone: 'busy', text: t('engineWarming') };
    case 'ready':
      return { tone: 'ready', text: t('engineReady') };
    case 'error':
      return {
        tone: 'error',
        text: status.message ? t('engineFailedWhy', status.message) : t('engineFailed'),
      };
  }
}
