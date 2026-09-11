import { describe, expect, it } from 'vitest';
import { MODEL } from './models';
import {
  cosine, normalize, passes, positionFromStrictness,
  scoreAgainstTopics, strictnessFromPosition,
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
    expect(passes(scoreAgainstTopics(v(1, 0), []), 0)).toBe(false);
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

describe('strictness position', () => {
  it('maps the slider onto the model band', () => {
    expect(strictnessFromPosition(0)).toBeCloseTo(MODEL.bandMin);
    expect(strictnessFromPosition(1)).toBeCloseTo(MODEL.bandMax);
  });

  it('clamps out-of-range positions', () => {
    expect(strictnessFromPosition(-3)).toBeCloseTo(MODEL.bandMin);
    expect(strictnessFromPosition(9)).toBeCloseTo(MODEL.bandMax);
  });

  it('round-trips', () => {
    expect(positionFromStrictness(strictnessFromPosition(0.43))).toBeCloseTo(0.43);
  });
});

describe('passes', () => {
  it('keeps a post at or above the threshold', () => {
    expect(passes(strictnessFromPosition(0.5), 0.5)).toBe(true);
  });

  it('blurs a post below it, whatever its length', () => {
    expect(passes(MODEL.bandMin - 0.01, 0.5)).toBe(false);
  });

  it('keeps everything at position zero, the loosest setting', () => {
    expect(passes(MODEL.bandMin, 0)).toBe(true);
  });
});
