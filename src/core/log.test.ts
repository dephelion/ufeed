import { afterEach, describe, expect, it, vi } from 'vitest';

const METHODS = ['log', 'info', 'debug', 'warn', 'error'] as const;
const original = Object.fromEntries(METHODS.map((m) => [m, console[m]]));

async function loadLog(debug: boolean) {
  vi.resetModules();
  vi.doMock('./debug', () => ({ DEBUG: debug }));
  const spies = Object.fromEntries(
    METHODS.map((m) => [m, vi.spyOn(console, m).mockImplementation(() => {})]),
  ) as Record<(typeof METHODS)[number], ReturnType<typeof vi.spyOn>>;
  return { ...(await import('./log')), spies };
}

afterEach(() => {
  vi.restoreAllMocks();
  for (const m of METHODS) console[m] = original[m]!;
});

describe('logger', () => {
  it('prints only bugs in a release build', async () => {
    const { logger, spies } = await loadLog(false);
    const log = logger('test');
    log.info('state');
    log.warn('handled');
    log.error('bug');
    expect(spies.info).not.toHaveBeenCalled();
    expect(spies.warn).not.toHaveBeenCalled();
    expect(spies.error).toHaveBeenCalledOnce();
  });

  it('keeps handled conditions off console.warn in a debug build', async () => {
    const { logger, spies } = await loadLog(true);
    logger('test').warn('handled');
    expect(spies.warn).not.toHaveBeenCalled();
    expect(spies.error).not.toHaveBeenCalled();
    expect(spies.info).toHaveBeenCalledOnce();
  });
});

describe('captureConsole', () => {
  it('silences library output in a release build', async () => {
    const { captureConsole, spies } = await loadLog(false);
    captureConsole('runtime');
    console.warn('Unable to determine content-length from response headers.');
    console.error('An error occurred during model execution');
    for (const m of METHODS) expect(spies[m]).not.toHaveBeenCalled();
  });

  it('never forwards the arguments that carry model inputs', async () => {
    const { captureConsole, spies } = await loadLog(true);
    captureConsole('runtime');
    console.error('Inputs given to model:', { input_ids: 'a private post' });
    expect(spies.info).toHaveBeenCalledOnce();
    expect(String(spies.info.mock.calls[0]?.[0])).not.toContain('a private post');
  });
});
