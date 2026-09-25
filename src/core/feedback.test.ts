import { describe, expect, it } from 'vitest';
import { modelFor } from './models';
import {
  EMPTY_FEEDBACK,
  emptyFor,
  feedbackFor,
  forCurrentModel,
  normalizeStore,
  withFeedback,
  MAX_PER_CLASS,
  correctionsFor,
  count,
  countFor,
  counts,
  findRating,
  forTopics,
  normalizeFeedback,
  rate,
} from './feedback';

const v = (n: number) => [n, n, n];
const up = (f = EMPTY_FEEDBACK, topic = 'software', key = 'a') =>
  rate(f, topic, key, v(1), true);

describe('rate', () => {
  it('files a correction under the line it was given against', () => {
    const f = up();
    expect(countFor(f, 'software')).toBe(1);
    expect(findRating(f, 'a')).toEqual({ topic: 'software', liked: true });
  });

  it('un-rates on the same thumb twice, rather than stacking a duplicate', () => {
    const f = rate(up(), 'software', 'a', v(1), true);
    expect(count(f)).toBe(0);
  });

  it('flips rather than holding a post on both sides at once', () => {
    const f = rate(up(), 'software', 'a', v(1), false);
    expect(count(f)).toBe(1);
    expect(findRating(f, 'a')?.liked).toBe(false);
    expect(correctionsFor(f, 'software').liked).toHaveLength(0);
    expect(correctionsFor(f, 'software').disliked).toHaveLength(1);
  });

  it('keeps the stored vector on a flip, since a re-click passes none', () => {
    const f = rate(up(), 'software', 'a', [], false);
    expect(correctionsFor(f, 'software').disliked).toEqual([v(1)]);
  });

  it('flips in place, keeping the line it was already filed under', () => {
    const f = rate(up(EMPTY_FEEDBACK, 'software'), 'video games', 'a', v(1), false);
    expect(countFor(f, 'software')).toBe(1);
    expect(countFor(f, 'video games')).toBe(0);
  });

  it('counts a repeat click as one post however many times it is clicked', () => {
    let f = EMPTY_FEEDBACK;
    for (let i = 0; i < 5; i++) f = rate(f, 'software', 'a', v(1), true);
    expect(count(f)).toBe(1);
  });

  it('keeps distinct posts apart', () => {
    const f = rate(up(), 'software', 'b', v(2), true);
    expect(countFor(f, 'software')).toBe(2);
  });

  it('drops the oldest of that side past the cap', () => {
    let f = EMPTY_FEEDBACK;
    for (let i = 0; i < MAX_PER_CLASS + 5; i++) {
      f = rate(f, 'software', `k${i}`, v(i), true);
    }
    expect(correctionsFor(f, 'software').liked).toHaveLength(MAX_PER_CLASS);
    expect(findRating(f, 'k0')).toBeUndefined();
    expect(findRating(f, `k${MAX_PER_CLASS + 4}`)).toBeDefined();
  });

  it('caps each side separately, so dislikes never evict likes', () => {
    let f = EMPTY_FEEDBACK;
    for (let i = 0; i < MAX_PER_CLASS + 5; i++) {
      f = rate(f, 'software', `d${i}`, v(i), false);
    }
    f = rate(f, 'software', 'liked-one', v(1), true);
    expect(correctionsFor(f, 'software').liked).toHaveLength(1);
    expect(correctionsFor(f, 'software').disliked).toHaveLength(MAX_PER_CLASS);
  });

  it('ignores a correction with no vector or no line to attach it to', () => {
    expect(count(rate(EMPTY_FEEDBACK, 'software', 'a', [], true))).toBe(0);
    expect(count(rate(EMPTY_FEEDBACK, '', 'a', v(1), true))).toBe(0);
  });
});

describe('forTopics', () => {
  const two = rate(up(), 'games', 'b', v(2), true);

  it('keeps corrections for lines that still exist', () => {
    expect(count(forTopics(two, ['software', 'games']))).toBe(2);
  });

  it('drops only the edited line, never the untouched ones', () => {
    const next = forTopics(two, ['software', 'video games']);
    expect(countFor(next, 'software')).toBe(1);
    expect(countFor(next, 'games')).toBe(0);
  });

  it('survives reordering, since corrections are keyed by the line itself', () => {
    expect(count(forTopics(two, ['games', 'software']))).toBe(2);
  });
});

describe('normalizeFeedback', () => {
  it('reads back what it wrote', () => {
    const f = rate(EMPTY_FEEDBACK, 'software', 'a', v(1), true);
    expect(normalizeFeedback(JSON.parse(JSON.stringify(f)))).toEqual(f);
  });

  it('drops the previous per-topic shape instead of crashing on it', () => {
    const old = { byTopic: { software: { liked: [v(1)], disliked: [] } } };
    expect(count(normalizeFeedback(old))).toBe(0);
  });

  it('drops the original flat shape too', () => {
    const oldest = { topics: ['software'], liked: [v(1)], disliked: [] };
    expect(count(normalizeFeedback(oldest))).toBe(0);
  });

  it('survives nothing stored at all', () => {
    // Nothing stored reads as the pre-stamp assumption: e5-small-v2's empty set.
    expect(normalizeFeedback(undefined).byTopic).toEqual({});
    expect(normalizeFeedback(undefined).model).toBe('Xenova/e5-small-v2');
    for (const junk of [null, 'garbage']) {
      expect(normalizeFeedback(junk).byTopic).toEqual({});
      expect(normalizeFeedback(junk).model).toBe('Xenova/e5-small-v2');
    }
  });

  it('keeps the good ratings and drops only the malformed ones', () => {
    const mixed = {
      byTopic: {
        software: [
          { key: 'a', vector: v(1), liked: true },
          { key: 'b', vector: 'not a vector', liked: true },
          { key: 'c', vector: [1, null], liked: false },
        ],
      },
    };
    expect(count(normalizeFeedback(mixed))).toBe(1);
    expect(findRating(normalizeFeedback(mixed), 'a')).toBeDefined();
  });
});

describe('counts', () => {
  it('splits ups from downs and totals them', () => {
    let f = rate(EMPTY_FEEDBACK, 'software', 'a', v(1), true);
    f = rate(f, 'software', 'b', v(2), true);
    f = rate(f, 'games', 'c', v(3), false);
    expect(counts(f)).toEqual({ up: 2, down: 1, total: 3 });
  });

  it('is all zeros with nothing rated', () => {
    expect(counts(EMPTY_FEEDBACK)).toEqual({ up: 0, down: 0, total: 0 });
  });

  it('follows a flip rather than counting the post twice', () => {
    const f = rate(
      rate(EMPTY_FEEDBACK, 'software', 'a', v(1), true),
      'software',
      'a',
      v(1),
      false,
    );
    expect(counts(f)).toEqual({ up: 0, down: 1, total: 1 });
  });
});

describe('the model stamp', () => {
  const spec = modelFor('e5-small');
  const mine = () => emptyFor(spec);

  it('reads corrections written before the stamp existed as e5-small-v2', () => {
    const legacy = { byTopic: { software: [{ key: 'a', vector: v(1), liked: true }] } };
    expect(normalizeFeedback(legacy).model).toBe('Xenova/e5-small-v2');
    expect(forCurrentModel(normalizeFeedback(legacy), spec).byTopic).not.toEqual({});
  });

  it('keeps what the running model wrote', () => {
    const rated = rate(mine(), 'software', 'a', v(1), true);
    expect(forCurrentModel(rated, spec)).toBe(rated);
  });

  it("reads another model's vectors as none of its own", () => {
    const foreign = { ...rate(mine(), 'software', 'a', v(1), true), model: 'other' };
    expect(forCurrentModel(foreign, spec)).toEqual(emptyFor(spec));
  });

  it('reads vectors of another width as none of its own', () => {
    const wide = { ...rate(mine(), 'software', 'a', v(1), true), dim: spec.dim * 2 };
    expect(forCurrentModel(wide, spec)).toEqual(emptyFor(spec));
  });
});

describe('ratings kept per model', () => {
  const e5 = modelFor('e5-small');
  const gemma = modelFor('gemma');

  it("files each model's ratings under its own id", () => {
    const store = withFeedback({}, e5, rate(emptyFor(e5), 't', 'a', v(1), true));
    const both = withFeedback(store, gemma, rate(emptyFor(gemma), 't', 'b', v(2), false));
    expect(count(feedbackFor(both, e5))).toBe(1);
    expect(count(feedbackFor(both, gemma))).toBe(1);
  });

  it('leaves the other model untouched when one is written', () => {
    const store = withFeedback({}, e5, rate(emptyFor(e5), 't', 'a', v(1), true));
    const after = withFeedback(store, gemma, emptyFor(gemma));
    expect(count(feedbackFor(after, e5))).toBe(1);
  });

  it("reads a pre-0.8 flat blob as e5-small-v2's, not the current model's", () => {
    const legacy = { byTopic: { t: [{ key: 'a', vector: v(1), liked: true }] } };
    const store = normalizeStore(legacy);
    expect(count(feedbackFor(store, e5))).toBe(1);
    expect(count(feedbackFor(store, gemma))).toBe(0);
  });

  it('survives a round trip through the stored shape', () => {
    const store = withFeedback({}, gemma, rate(emptyFor(gemma), 't', 'a', v(3), true));
    expect(count(feedbackFor(normalizeStore(store), gemma))).toBe(1);
  });

  it('reads junk as no ratings rather than trusting it', () => {
    expect(feedbackFor(normalizeStore(null), e5).byTopic).toEqual({});
    expect(feedbackFor(normalizeStore({ 'x/y': 7 }), e5).byTopic).toEqual({});
  });
});
