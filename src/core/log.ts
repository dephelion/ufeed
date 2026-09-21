/**
 * Never pass post text to a logger. Counts, scores, states and errors only —
 * post text must not reach a console, a devtools recording, or a crash report.
 */
import { DEBUG } from './debug';

type Fields = Record<string, string | number | boolean | undefined>;

const PREFIX = 'ufeed';

// Bound at import, so captureConsole() cannot swallow our own lines.
const sink = { info: console.info.bind(console), error: console.error.bind(console) };

function emit(
  level: 'info' | 'warn' | 'error',
  scope: string,
  message: string,
  fields?: Fields,
) {
  if (!DEBUG && level !== 'error') return;
  const parts = fields
    ? Object.entries(fields)
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => `${k}=${String(v)}`)
        .join(' ')
    : '';
  const tag = level === 'warn' ? 'warning: ' : '';
  const line = `[${PREFIX}:${scope}] ${tag}${message}${parts ? ' ' + parts : ''}`;
  if (level === 'error') sink.error(line);
  else sink.info(line);
}

/**
 * `info` and `warn` are debug-build diagnostics; `warn` marks a condition the code
 * handles. `error` is a uFeed bug and the only level a release prints. See conventions.md §Logging.
 */
export interface Logger {
  info(message: string, fields?: Fields): void;
  warn(message: string, fields?: Fields): void;
  error(message: string, fields?: Fields): void;
}

export function logger(scope: string): Logger {
  return {
    info: (m, f) => emit('info', scope, m, f),
    warn: (m, f) => emit('warn', scope, m, f),
    error: (m, f) => emit('error', scope, m, f),
  };
}

/** First argument only: transformers.js prints model inputs, which are post text. */
export function captureConsole(scope: string): void {
  const log = logger(scope);
  const forward = (...args: unknown[]) => {
    if (typeof args[0] === 'string') log.info(args[0]);
  };
  for (const method of ['log', 'info', 'debug', 'warn', 'error'] as const) {
    console[method] = forward;
  }
}
