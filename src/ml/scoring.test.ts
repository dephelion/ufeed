import { describe, expect, it } from 'vitest';
import { MODEL } from './models';
import {
  MIN_SAMPLE,
  PEEK_BAND,
  applyFeedback,
  cosine,
  normalize,
  positionFromStrictness,
  scoreAgainstTopics,
  strictnessFromPosition,
  thresholdForFraction,
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

describe('scoreAgainstTopics', () => {
  it('returns the closest topic, not the average', () => {
    const post = v(1, 0);
    expect(scoreAgainstTopics(post, [v(0, 1), v(1, 0)])).toBeCloseTo(1);
  });

  it('scores below any threshold when there are no topics', () => {
    expect(verdictAt(scoreAgainstTopics(v(1, 0), []), strictnessFromPosition(0))).toBe(
      'blur',
    );
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

describe('the three tiers', () => {
  const thr = strictnessFromPosition(0.5);

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

  it('keeps everything at position zero, the loosest setting', () => {
    expect(verdictAt(MODEL.bandMin, strictnessFromPosition(0))).toBe('show');
  });

  it('measures the strip from the threshold, so it moves with strictness', () => {
    const loose = strictnessFromPosition(0.2);
    expect(verdictAt(loose - 0.005, loose)).toBe('peek');
    expect(verdictAt(loose - 0.005, strictnessFromPosition(0.9))).toBe('blur');
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
