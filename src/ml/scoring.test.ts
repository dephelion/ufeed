import { describe, expect, it } from 'vitest';
import {
  DEFAULT_STRICTNESS, FULL_LENGTH_CHARS, STRICTNESS_MAX, STRICTNESS_MIN,
  cosine, normalize, passes, scoreAgainstTopics,
  SHORT_PENALTY_MAX, sliderFromStrictness, strictnessFromSlider, thresholdFor,
} from './scoring';

const v = (...xs: number[]) => new Float32Array(xs);

describe('cosine', () => {
  it('is 1 for a unit vector against itself', () => {
    expect(cosine(v(1, 0, 0), v(1, 0, 0))).toBeCloseTo(1);
  });

  it('is 0 for orthogonal vectors', () => {
    expect(cosine(v(1, 0), v(0, 1))).toBeCloseTo(0);
  });

  it('rejects mismatched lengths rather than scoring garbage', () => {
    expect(() => cosine(v(1, 0), v(1, 0, 0))).toThrow();
  });
});

describe('scoreAgainstTopics', () => {
  it('returns the closest topic, not the average', () => {
    const post = v(1, 0);
    expect(scoreAgainstTopics(post, [v(0, 1), v(1, 0)])).toBeCloseTo(1);
  });

  it('scores below any threshold when there are no topics', () => {
    expect(passes(scoreAgainstTopics(v(1, 0), []), STRICTNESS_MIN, 500)).toBe(false);
  });
});

describe('strictness slider', () => {
  it('maps the slider onto the measured band, not 0..1', () => {
    expect(strictnessFromSlider(0)).toBeCloseTo(STRICTNESS_MIN);
    expect(strictnessFromSlider(1)).toBeCloseTo(STRICTNESS_MAX);
  });

  it('clamps out-of-range positions', () => {
    expect(strictnessFromSlider(-5)).toBeCloseTo(STRICTNESS_MIN);
    expect(strictnessFromSlider(5)).toBeCloseTo(STRICTNESS_MAX);
  });

  it('round-trips', () => {
    expect(strictnessFromSlider(sliderFromStrictness(DEFAULT_STRICTNESS)))
      .toBeCloseTo(DEFAULT_STRICTNESS);
  });
});

describe('normalize', () => {
  it('produces a unit vector', () => {
    expect(cosine(normalize(v(3, 4)), normalize(v(3, 4)))).toBeCloseTo(1);
  });

  it('leaves a zero vector alone rather than dividing by zero', () => {
    expect(Array.from(normalize(v(0, 0)))).toEqual([0, 0]);
  });
});

describe('thresholdFor', () => {
  it('leaves long posts at the plain strictness', () => {
    expect(thresholdFor(0.1, FULL_LENGTH_CHARS)).toBeCloseTo(0.1);
    expect(thresholdFor(0.1, 5000)).toBeCloseTo(0.1);
  });

  it('demands more from a three-word post than a full one', () => {
    expect(thresholdFor(0.1, 32)).toBeGreaterThan(thresholdFor(0.1, 300));
  });

  it('climbs smoothly, so one extra character never flips a post', () => {
    const a = thresholdFor(0.1, 99);
    const b = thresholdFor(0.1, 100);
    expect(Math.abs(a - b)).toBeLessThan(0.001);
  });

  it('never exceeds the no-length ceiling', () => {
    expect(thresholdFor(0.1, 0)).toBeCloseTo(0.18);
  });

  it('treats a negative length as empty rather than inverting', () => {
    expect(thresholdFor(0.1, -20)).toBeCloseTo(0.18);
  });
});

describe('passes with length', () => {
  it('blurs the short off-topic post that slipped through a flat threshold', () => {
    // "Almeida destrozando a TelePedro." — 32 chars, scored 0.133 against "tech".
    expect(passes(0.133, 0.104, 32)).toBe(false);
  });

  it('still keeps a long post at the same score', () => {
    expect(passes(0.133, 0.104, 300)).toBe(true);
  });
});

describe('thresholdFor with a configurable penalty', () => {
  it('disables the penalty at zero, so length stops mattering', () => {
    expect(thresholdFor(0.1, 10, 0)).toBeCloseTo(0.1);
    expect(thresholdFor(0.1, 300, 0)).toBeCloseTo(0.1);
  });

  it('raises the bar further as the penalty grows', () => {
    expect(thresholdFor(0.1, 30, 1.5)).toBeGreaterThan(thresholdFor(0.1, 30, 0.5));
  });

  it('clamps a penalty beyond the maximum', () => {
    expect(thresholdFor(0.1, 0, 99)).toBeCloseTo(thresholdFor(0.1, 0, SHORT_PENALTY_MAX));
  });

  it('clamps a negative penalty to none', () => {
    expect(thresholdFor(0.1, 10, -5)).toBeCloseTo(0.1);
  });

  it('never changes a long post, whatever the penalty', () => {
    expect(thresholdFor(0.1, 400, 2)).toBeCloseTo(0.1);
  });
});
