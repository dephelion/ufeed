import { describe, expect, it } from 'vitest';
import {
  describeEngine,
  summarizeEngine,
  toStatus,
  worthReporting,
  type EngineStatus,
} from './engine-status';
import { translate as t } from '../platform/i18n';

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

  it('carries the message through', () => {
    const out = toStatus({
      type: 'STATUS',
      state: 'error',
      message: 'model returns wrong vectors',
    });
    expect(out).toEqual({
      state: 'error',
      message: 'model returns wrong vectors',
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
    const { tone, text } = describeEngine(undefined, t);
    expect(tone).toBe('idle');
    expect(text).toMatch(/no engine on this tab/i);
  });

  it('names the download as one-time, because the wait needs explaining', () => {
    const { tone, text } = describeEngine(
      status({ state: 'downloading', progress: 37 }),
      t,
    );
    expect(tone).toBe('busy');
    expect(text).toContain('37%');
    expect(text).toMatch(/one time/i);
  });

  it('survives a download with no percentage yet', () => {
    const { text } = describeEngine(status({ state: 'downloading' }), t);
    expect(text).not.toContain('undefined');
    expect(text).not.toContain('NaN');
  });

  it('reports ready without printing undefined', () => {
    const { tone, text } = describeEngine(status({ state: 'ready' }), t);
    expect(tone).toBe('ready');
    expect(text).not.toContain('undefined');
  });

  it('surfaces the failure reason, since that is what a bug report needs', () => {
    const { tone, text } = describeEngine(
      status({ state: 'error', message: 'model returns wrong vectors' }),
      t,
    );
    expect(tone).toBe('error');
    expect(text).toContain('model returns wrong vectors');
    expect(text).toMatch(/reload this tab/i);
    expect(text).toMatch(/restart your browser/i);
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
      status({ state: 'ready' }),
      status({ state: 'error', message: 'a'.repeat(200) }),
    ];
    for (const s of states) {
      expect(summarizeEngine(s, t).text.length).toBeLessThanOrEqual(LIMIT);
    }
    expect(summarizeEngine(undefined, t).text.length).toBeLessThanOrEqual(LIMIT);
  });

  it('keeps the percentage, which is the only part that moves', () => {
    expect(summarizeEngine(status({ state: 'downloading', progress: 7 }), t).text).toBe(
      'Downloading 7%',
    );
  });

  it('drops the failure reason, which the footer line keeps', () => {
    const failed = status({ state: 'error', message: 'model returns wrong vectors' });
    expect(summarizeEngine(failed, t).text).toBe('Failed');
    expect(describeEngine(failed, t).text).toContain('model returns wrong vectors');
  });

  it('distinguishes a tab with no engine from one that has not started', () => {
    expect(summarizeEngine(undefined, t).text).toBe('No feed here');
    expect(summarizeEngine(status({ state: 'idle' }), t).text).toBe('Not started');
  });

  it('agrees with the long form on tone, so the two lights never disagree', () => {
    const states: EngineStatus[] = [
      status({ state: 'idle' }),
      status({ state: 'downloading', progress: 50 }),
      status({ state: 'warming' }),
      status({ state: 'ready' }),
      status({ state: 'error' }),
    ];
    for (const s of states) {
      expect(summarizeEngine(s, t).tone).toBe(describeEngine(s, t).tone);
    }
    expect(summarizeEngine(undefined, t).tone).toBe(describeEngine(undefined, t).tone);
  });
});
