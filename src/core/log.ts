/**
 * Never pass post text to a logger. Counts, scores, states and errors only —
 * post text must not reach a console, a devtools recording, or a crash report.
 */
import { DEBUG } from './debug';

type Fields = Record<string, string | number | boolean | undefined>;

const PREFIX = 'lensing';

function emit(
  level: 'log' | 'warn' | 'error',
  scope: string,
  message: string,
  fields?: Fields,
) {
  if (!DEBUG && level === 'log') return;
  const parts = fields
    ? Object.entries(fields)
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => `${k}=${String(v)}`)
        .join(' ')
    : '';
  // eslint-disable-next-line no-console
  console[level](`[${PREFIX}:${scope}] ${message}${parts ? ' ' + parts : ''}`);
}

export interface Logger {
  info(message: string, fields?: Fields): void;
  warn(message: string, fields?: Fields): void;
  error(message: string, fields?: Fields): void;
}

export function logger(scope: string): Logger {
  return {
    info: (m, f) => emit('log', scope, m, f),
    warn: (m, f) => emit('warn', scope, m, f),
    error: (m, f) => emit('error', scope, m, f),
  };
}
