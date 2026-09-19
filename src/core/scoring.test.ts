import { describe, expect, it } from 'vitest';
import { DEFAULT_MODEL, DEFAULT_STRICTNESS, MODELS, modelFor } from './models';
import {
  MAX_STRICTNESS,
  bestMatch,
  clampStrictness,
  cosine,
  feedShownAt,
  normalize,
  pooled,
  ratingNear,
  thresholdForStrictness,
  verdictAt,
} from './scoring';

const v = (...xs: number[]) => new Float32Array(xs);

/** The shipped default; every assertion about the scale must hold for each model. */
const spec = modelFor(DEFAULT_MODEL);
const PEEK_BAND = spec.peekBand;

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
    expect(match.lines.map((s) => Math.round(s))).toEqual([0, 1]);
  });

  it('scores below any threshold when there are no topics', () => {
    const match = bestMatch(v(1, 0), []);
    expect(match.topic).toBe(-1);
    expect(verdictAt(match.score, thresholdForStrictness(0, spec), spec)).toBe('blur');
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
    expect(spec.strictness).toHaveLength(11);
  });

  it('blurs nothing at 0, which is the point of starting at the feed floor', () => {
    expect(feedShownAt(0, spec)).toBe(1);
  });

  it('every step is stricter than the one before it', () => {
    for (let i = 1; i <= MAX_STRICTNESS; i++) {
      expect(thresholdForStrictness(i, spec)).toBeGreaterThan(
        thresholdForStrictness(i - 1, spec),
      );
      expect(feedShownAt(i, spec)).toBeLessThan(feedShownAt(i - 1, spec));
    }
  });

  it('every step changes what the reader sees, which the old band did not', () => {
    for (let i = 1; i <= MAX_STRICTNESS; i++) {
      expect(feedShownAt(i - 1, spec) - feedShownAt(i, spec)).toBeGreaterThanOrEqual(
        0.05,
      );
    }
  });

  it('defaults to step 7, the best measured trade-off', () => {
    expect(DEFAULT_STRICTNESS).toBe(7);
  });

  it('clamps off-scale values onto the nearest step', () => {
    expect(clampStrictness(-3)).toBe(0);
    expect(clampStrictness(99)).toBe(MAX_STRICTNESS);
    expect(clampStrictness(3.4)).toBe(3);
    expect(clampStrictness(NaN)).toBe(0);
  });
});

describe('the three tiers', () => {
  const thr = thresholdForStrictness(5, spec);

  it('shows a post at or above the threshold', () => {
    expect(verdictAt(thr, thr, spec)).toBe('show');
  });

  it('peeks just below it, where the model is least sure', () => {
    expect(verdictAt(thr - 0.001, thr, spec)).toBe('peek');
    expect(verdictAt(thr - PEEK_BAND, thr, spec)).toBe('peek');
  });

  it('blurs outright once past the uncertain strip', () => {
    expect(verdictAt(thr - PEEK_BAND - 0.001, thr, spec)).toBe('blur');
  });

  it('keeps a post scoring below every real feed post at strictness 0', () => {
    expect(verdictAt(0.7, thresholdForStrictness(0, spec), spec)).toBe('show');
  });

  it('measures the strip from the threshold, so it moves with strictness', () => {
    const loose = thresholdForStrictness(2, spec);
    expect(verdictAt(loose - 0.005, loose, spec)).toBe('peek');
    expect(verdictAt(loose - 0.005, thresholdForStrictness(9, spec), spec)).toBe('blur');
  });
});

describe('ratingNear', () => {
  const post = normalize(v(1, 0));
  const same = normalize(v(1, 0.01));
  const other = normalize(v(0, 1));

  it('overrides nothing when no rated post is near enough', () => {
    expect(ratingNear(post, [other], [other], 0.92)).toBeUndefined();
  });

  it('follows a near-identical liked post', () => {
    expect(ratingNear(post, [same], [other], 0.92)).toBe(true);
  });

  it('follows a near-identical disliked post', () => {
    expect(ratingNear(post, [other], [same], 0.92)).toBe(false);
  });

  it('follows the closer rating when both sides are near', () => {
    const closer = normalize(v(1, 0.001));
    expect(ratingNear(post, [same], [closer], 0.92)).toBe(false);
    expect(ratingNear(post, [closer], [same], 0.92)).toBe(true);
  });
});

describe('pooled', () => {
  it('applies a rating filed under any line, whichever line the copy lands on', () => {
    const post = normalize(v(1, 0));
    const same = normalize(v(1, 0.01));
    const all = pooled([
      { liked: [], disliked: [] },
      { liked: [], disliked: [same] },
    ]);
    expect(ratingNear(post, all.liked, all.disliked, 0.92)).toBe(false);
  });
});

describe('verdictAt', () => {
  it('reads tiers off a resolved threshold, wherever it came from', () => {
    expect(verdictAt(0.9, 0.8, spec)).toBe('show');
    expect(verdictAt(0.795, 0.8, spec)).toBe('peek');
    expect(verdictAt(0.5, 0.8, spec)).toBe('blur');
  });
});

describe('every model carries a usable scale', () => {
  it('gives each the same number of steps, so a stored step survives a switch', () => {
    for (const model of Object.values(MODELS))
      expect(model.strictness).toHaveLength(MAX_STRICTNESS + 1);
  });

  it('spends the same share of feed at a given step on every model', () => {
    for (const model of Object.values(MODELS))
      for (let i = 0; i <= MAX_STRICTNESS; i++)
        expect(feedShownAt(i, model)).toBe(feedShownAt(i, spec));
  });

  it('rises monotonically on every model, whatever band it scores in', () => {
    for (const model of Object.values(MODELS))
      for (let i = 1; i <= MAX_STRICTNESS; i++)
        expect(thresholdForStrictness(i, model)).toBeGreaterThan(
          thresholdForStrictness(i - 1, model),
        );
  });

  it('leaves a peek strip that fits inside its own scale', () => {
    for (const model of Object.values(MODELS)) {
      expect(model.peekBand).toBeGreaterThan(0);
      const span =
        thresholdForStrictness(MAX_STRICTNESS, model) - thresholdForStrictness(0, model);
      expect(model.peekBand).toBeLessThan(span / 2);
    }
  });
});
