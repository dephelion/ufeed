import { describe, expect, it } from 'vitest';
import { DEFAULT_STRICTNESS, STRICTNESS_STEPS } from './models';
import {
  MAX_STRICTNESS,
  MIN_SAMPLE,
  PEEK_BAND,
  applyFeedback,
  bestMatch,
  clampStrictness,
  cosine,
  feedShownAt,
  junkShownAt,
  normalize,
  thresholdForFraction,
  thresholdForStrictness,
  verdictAt,
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

describe('bestMatch', () => {
  it('returns the closest topic and its line, not the average', () => {
    const match = bestMatch(v(1, 0), [v(0, 1), v(1, 0)]);
    expect(match.score).toBeCloseTo(1);
    expect(match.topic).toBe(1);
  });

  it('scores below any threshold when there are no topics', () => {
    const match = bestMatch(v(1, 0), []);
    expect(match.topic).toBe(-1);
    expect(verdictAt(match.score, thresholdForStrictness(0))).toBe('blur');
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

describe('the strictness scale', () => {
  it('runs 0 to 10', () => {
    expect(MAX_STRICTNESS).toBe(10);
    expect(STRICTNESS_STEPS).toHaveLength(11);
  });

  it('blurs nothing at 0, which is the point of starting at the feed floor', () => {
    expect(feedShownAt(0)).toBe(1);
  });

  it('every step is stricter than the one before it', () => {
    for (let i = 1; i <= MAX_STRICTNESS; i++) {
      expect(thresholdForStrictness(i)).toBeGreaterThan(thresholdForStrictness(i - 1));
      expect(feedShownAt(i)).toBeLessThan(feedShownAt(i - 1));
    }
  });

  it('every step changes what the reader sees, which the old band did not', () => {
    for (let i = 1; i <= MAX_STRICTNESS; i++) {
      expect(feedShownAt(i - 1) - feedShownAt(i)).toBeGreaterThanOrEqual(0.05);
    }
  });

  it('defaults where the junk is halved, not where the recall reads best', () => {
    expect(DEFAULT_STRICTNESS).toBe(7);
    expect(junkShownAt(DEFAULT_STRICTNESS)).toBeLessThan(junkShownAt(5) - 0.1);
  });

  it('lets less junk through as it tightens, up to the point the sample thins', () => {
    for (let i = 1; i <= 9; i++) {
      expect(junkShownAt(i)).toBeLessThanOrEqual(junkShownAt(i - 1));
    }
  });

  it('clamps off-scale values onto the nearest step', () => {
    expect(clampStrictness(-3)).toBe(0);
    expect(clampStrictness(99)).toBe(MAX_STRICTNESS);
    expect(clampStrictness(3.4)).toBe(3);
    expect(clampStrictness(NaN)).toBe(0);
  });
});

describe('the three tiers', () => {
  const thr = thresholdForStrictness(5);

  it('shows a post at or above the threshold', () => {
    expect(verdictAt(thr, thr)).toBe('show');
  });

  it('peeks just below it, where the model is least sure', () => {
    expect(verdictAt(thr - 0.001, thr)).toBe('peek');
    expect(verdictAt(thr - PEEK_BAND, thr)).toBe('peek');
  });

  it('blurs outright once past the uncertain strip', () => {
    expect(verdictAt(thr - PEEK_BAND - 0.001, thr)).toBe('blur');
  });

  it('keeps a post scoring below every real feed post at strictness 0', () => {
    expect(verdictAt(0.7, thresholdForStrictness(0))).toBe('show');
  });

  it('measures the strip from the threshold, so it moves with strictness', () => {
    const loose = thresholdForStrictness(2);
    expect(verdictAt(loose - 0.005, loose)).toBe('peek');
    expect(verdictAt(loose - 0.005, thresholdForStrictness(9))).toBe('blur');
  });
});

describe('applyFeedback', () => {
  const topic = normalize(v(1, 0));
  const post = normalize(v(0, 1));

  it('returns the topic untouched when there is nothing to learn from', () => {
    expect(applyFeedback(topic, [], [])).toBe(topic);
  });

  it('pulls the query toward a liked post, so its neighbours score higher', () => {
    const before = cosine(topic, post);
    const after = cosine(applyFeedback(topic, [post], []), post);
    expect(after).toBeGreaterThan(before);
  });

  it('pushes it away from a disliked post', () => {
    const before = cosine(topic, post);
    const after = cosine(applyFeedback(topic, [], [post]), post);
    expect(after).toBeLessThan(before);
  });

  it('stays a unit vector, or every score downstream shifts scale', () => {
    const moved = applyFeedback(topic, [post], [normalize(v(1, 1))]);
    expect(cosine(moved, moved)).toBeCloseTo(1);
  });
});

describe('thresholdForFraction', () => {
  const scores = Array.from({ length: 100 }, (_, i) => i / 100);

  it('falls back to the absolute threshold below a usable sample', () => {
    expect(thresholdForFraction([0.1, 0.9], 0.5, 0.784)).toBe(0.784);
    expect(thresholdForFraction(scores.slice(0, MIN_SAMPLE - 1), 0.5, 0.784)).toBe(0.784);
  });

  it('cuts at the requested share of the feed', () => {
    expect(thresholdForFraction(scores, 0.2, 0)).toBeCloseTo(0.8, 1);
    expect(thresholdForFraction(scores, 0.5, 0)).toBeCloseTo(0.5, 1);
  });

  it('shows everything at fraction one, so a fully on-topic feed is never blurred', () => {
    const cut = thresholdForFraction(scores, 1, 0);
    expect(scores.every((s) => s >= cut)).toBe(true);
  });
});

describe('verdictAt', () => {
  it('reads tiers off a resolved threshold, wherever it came from', () => {
    expect(verdictAt(0.9, 0.8)).toBe('show');
    expect(verdictAt(0.795, 0.8)).toBe('peek');
    expect(verdictAt(0.5, 0.8)).toBe('blur');
  });
});
