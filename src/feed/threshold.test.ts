import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../core/settings';
import { MIN_SAMPLE, thresholdForStrictness } from '../ml/scoring';
import { ScoreWindow } from './threshold';

const absolute = thresholdForStrictness(DEFAULT_SETTINGS.strictness);

const fill = (w: ScoreWindow, line: string, scores: readonly number[]) => {
  for (const score of scores) w.add(line, score);
  return w;
};

const spread = (n: number, from = 0, step = 0.01) =>
  Array.from({ length: n }, (_, i) => from + i * step);

describe('ScoreWindow', () => {
  it('uses the slider threshold for an uncorrected line, whatever it scored', () => {
    const w = fill(new ScoreWindow(), 'tech', spread(100));
    expect(w.cut(DEFAULT_SETTINGS, 'tech', false)).toBeCloseTo(absolute);
  });

  it('uses the slider threshold for a post with no line', () => {
    expect(new ScoreWindow().cut(DEFAULT_SETTINGS, undefined, true)).toBeCloseTo(
      absolute,
    );
  });

  it('holds the slider threshold below a usable sample across all lines, even when corrected', () => {
    const w = fill(new ScoreWindow(), 'tech', spread(MIN_SAMPLE - 1));
    expect(w.cut(DEFAULT_SETTINGS, 'tech', true)).toBeCloseTo(absolute);
  });

  it('borrows every line’s scores while a corrected line has too few of its own', () => {
    const tech = spread(MIN_SAMPLE - 1, 0.6, 0.001);
    const cooking = spread(100, 0.7, 0.001);
    const w = fill(fill(new ScoreWindow(), 'tech', tech), 'cooking', cooking);
    const pooled = fill(new ScoreWindow(), 'all', [...tech, ...cooking]);
    expect(w.cut(DEFAULT_SETTINGS, 'tech', true)).toBeCloseTo(
      pooled.cut(DEFAULT_SETTINGS, 'all', true),
      5,
    );
  });

  it('follows a corrected line once it has enough scores of its own', () => {
    const cut = fill(new ScoreWindow(), 'tech', spread(100)).cut(
      DEFAULT_SETTINGS,
      'tech',
      true,
    );
    expect(cut).toBeLessThan(absolute);
    expect(cut).toBeGreaterThan(0);
  });

  it("cuts each line from its own scores, so one line's drop cannot hide another's posts", () => {
    const w = new ScoreWindow();
    fill(w, 'tech', spread(100, 0.7, 0.001));
    fill(w, 'cooking', spread(100, 0.8, 0.001));
    const tech = w.cut(DEFAULT_SETTINGS, 'tech', true);
    const cooking = w.cut(DEFAULT_SETTINGS, 'cooking', true);
    expect(tech).toBeCloseTo(cooking - 0.1, 5);
  });

  it('keeps only the recent window for each line', () => {
    const w = fill(new ScoreWindow(), 'tech', spread(400));
    expect(w.sizeOf('tech')).toBe(300);
  });

  it('forgets lines that are no longer set', () => {
    const w = new ScoreWindow();
    fill(w, 'tech', spread(50));
    fill(w, 'cooking', spread(50));
    w.keepOnly(['cooking']);
    expect(w.sizeOf('tech')).toBe(0);
    expect(w.sizeOf('cooking')).toBe(50);
  });
});
