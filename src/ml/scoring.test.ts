import { describe, expect, it } from 'vitest';
import {
  DEFAULT_STRICTNESS, STRICTNESS_MAX, STRICTNESS_MIN,
  cosine, normalize, passes, scoreAgainstTopics,
  sliderFromStrictness, strictnessFromSlider,
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
    expect(passes(scoreAgainstTopics(v(1, 0), []), STRICTNESS_MIN)).toBe(false);
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
