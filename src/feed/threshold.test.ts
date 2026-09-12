import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../core/settings';
import { MIN_SAMPLE, strictnessFromPosition } from '../ml/scoring';
import { ScoreWindow } from './threshold';

const absolute = strictnessFromPosition(DEFAULT_SETTINGS.strictness, {
  min: DEFAULT_SETTINGS.bandMin,
  max: DEFAULT_SETTINGS.bandMax,
});

const fill = (n: number, value = 0.5) => {
  const w = new ScoreWindow();
  w.add(Array.from({ length: n }, () => value));
  return w;
};

describe('ScoreWindow', () => {
  it('uses the slider threshold while unadapted, whatever the feed scored', () => {
    expect(fill(500).cut(DEFAULT_SETTINGS, false)).toBeCloseTo(absolute);
  });

  it('holds the slider threshold below a usable sample, even when adapted', () => {
    expect(fill(MIN_SAMPLE - 1).cut(DEFAULT_SETTINGS, true)).toBeCloseTo(absolute);
  });

  it('follows the feed once adapted and sampled', () => {
    const w = new ScoreWindow();
    w.add(Array.from({ length: 100 }, (_, i) => i / 100));
    const cut = w.cut(DEFAULT_SETTINGS, true);
    expect(cut).toBeLessThan(absolute);
    expect(cut).toBeGreaterThan(0);
  });

  it('ignores unscored posts rather than counting them as zero', () => {
    const w = new ScoreWindow();
    w.add([0.8, undefined, 0.9, undefined]);
    expect(w.size).toBe(2);
  });

  it('keeps only the recent window, so the cut follows the current feed', () => {
    const w = fill(400);
    expect(w.size).toBe(300);
  });
});
