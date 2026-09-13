import { describe, expect, it } from 'vitest';
import {
  describeEngine,
  summarizeEngine,
  toStatus,
  worthReporting,
  type EngineStatus,
} from './engine-status';

const status = (over: Partial<EngineStatus> = {}): EngineStatus => ({
  state: 'ready',
  ...over,
});

describe('toStatus', () => {
  it('rounds the float progress transformers.js reports', () => {
    const out = toStatus({
      type: 'STATUS',
      state: 'downloading',
      progress: 42.7,
    });
    expect(out.progress).toBe(43);
  });

  it('keeps progress undefined when there is none', () => {
    expect(toStatus({ type: 'STATUS', state: 'ready' }).progress).toBeUndefined();
  });

  it('carries backend, message and the timestamp through', () => {
    const out = toStatus({
      type: 'STATUS',
      state: 'error',
      message: 'no usable backend',
    });
    expect(out).toEqual({
      state: 'error',
      message: 'no usable backend',
      backend: undefined,
      progress: undefined,
    });
  });
});

describe('worthReporting', () => {
  it('reports the first status it ever sees', () => {
    expect(worthReporting(undefined, status())).toBe(true);
  });

  it('reports a state change', () => {
    expect(worthReporting(status({ state: 'warming' }), status({ state: 'ready' }))).toBe(
      true,
    );
  });

  it('swallows a percentage that barely moved', () => {
    const before = status({ state: 'downloading', progress: 40 });
    const after = status({ state: 'downloading', progress: 42 });
    expect(worthReporting(before, after)).toBe(false);
  });

  it('reports once the percentage moves a visible amount', () => {
    const before = status({ state: 'downloading', progress: 40 });
    const after = status({ state: 'downloading', progress: 45 });
    expect(worthReporting(before, after)).toBe(true);
  });

  it('reports when the backend changes under the same state', () => {
    const before = status({ backend: 'webgpu' });
    expect(worthReporting(before, status({ backend: 'wasm' }))).toBe(true);
  });

  it('reports when a message appears on an unchanged state', () => {
    const before = status({ state: 'error', message: 'first' });
    expect(worthReporting(before, status({ state: 'error', message: 'second' }))).toBe(
      true,
    );
  });

  it('reports when progress goes away, so a stale percentage cannot linger', () => {
    const before = status({ state: 'downloading', progress: 80 });
    expect(worthReporting(before, status({ state: 'downloading' }))).toBe(true);
  });
});

describe('describeEngine', () => {
  it("says there is no engine here rather than borrowing another tab's state", () => {
    const { tone, text } = describeEngine(undefined);
    expect(tone).toBe('idle');
    expect(text).toMatch(/no engine on this tab/i);
  });

  it('names the download as one-time, because the wait needs explaining', () => {
    const { tone, text } = describeEngine(status({ state: 'downloading', progress: 37 }));
    expect(tone).toBe('busy');
    expect(text).toContain('37%');
    expect(text).toMatch(/one time/i);
  });

  it('survives a download with no percentage yet', () => {
    const { text } = describeEngine(status({ state: 'downloading' }));
    expect(text).not.toContain('undefined');
    expect(text).not.toContain('NaN');
  });

  it('names the backend once ready, which is the whole point of showing it', () => {
    expect(describeEngine(status({ state: 'ready', backend: 'wasm' })).text).toContain(
      'wasm',
    );
  });

  it('reports ready without a backend rather than printing undefined', () => {
    const { tone, text } = describeEngine(status({ state: 'ready' }));
    expect(tone).toBe('ready');
    expect(text).not.toContain('undefined');
  });

  it('surfaces the failure reason, since that is what a bug report needs', () => {
    const { tone, text } = describeEngine(
      status({ state: 'error', message: 'no usable backend' }),
    );
    expect(tone).toBe('error');
    expect(text).toContain('no usable backend');
  });
});

describe('summarizeEngine', () => {
  /** It shares a 380px row with the title and the on/off switch. */
  const LIMIT = 18;

  it('stays short enough for the header in every state', () => {
    const states: EngineStatus[] = [
      status({ state: 'idle' }),
      status({ state: 'downloading', progress: 100 }),
      status({ state: 'downloading' }),
      status({ state: 'warming' }),
      status({ state: 'ready', backend: 'webgpu' }),
      status({ state: 'error', message: 'a'.repeat(200) }),
    ];
    for (const s of states) {
      expect(summarizeEngine(s).text.length).toBeLessThanOrEqual(LIMIT);
    }
    expect(summarizeEngine(undefined).text.length).toBeLessThanOrEqual(LIMIT);
  });

  it('keeps the percentage, which is the only part that moves', () => {
    expect(summarizeEngine(status({ state: 'downloading', progress: 7 })).text).toBe(
      'Downloading 7%',
    );
  });

  it('names the backend once ready, so a bug report carries it', () => {
    expect(summarizeEngine(status({ state: 'ready', backend: 'wasm' })).text).toBe(
      'Ready \u00b7 wasm',
    );
  });

  it('drops the failure reason, which the footer line keeps', () => {
    const failed = status({ state: 'error', message: 'no usable backend' });
    expect(summarizeEngine(failed).text).toBe('Failed');
    expect(describeEngine(failed).text).toContain('no usable backend');
  });

  it('distinguishes a tab with no engine from one that has not started', () => {
    expect(summarizeEngine(undefined).text).toBe('No feed here');
    expect(summarizeEngine(status({ state: 'idle' })).text).toBe('Not started');
  });

  it('agrees with the long form on tone, so the two lights never disagree', () => {
    const states: EngineStatus[] = [
      status({ state: 'idle' }),
      status({ state: 'downloading', progress: 50 }),
      status({ state: 'warming' }),
      status({ state: 'ready', backend: 'wasm' }),
      status({ state: 'error' }),
    ];
    for (const s of states) {
      expect(summarizeEngine(s).tone).toBe(describeEngine(s).tone);
    }
    expect(summarizeEngine(undefined).tone).toBe(describeEngine(undefined).tone);
  });
});
