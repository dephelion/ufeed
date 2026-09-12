import { describe, expect, it } from 'vitest';
import { EMPTY_FEEDBACK, MAX_PER_CLASS, count, forTopics, record } from './feedback';

const T = ['software'];
const v = (n: number) => [n, n, n];

describe('record', () => {
  it('keeps a liked and a disliked correction apart', () => {
    let f = record(EMPTY_FEEDBACK, T, v(1), true);
    f = record(f, T, v(2), false);
    expect(f.liked).toEqual([v(1)]);
    expect(f.disliked).toEqual([v(2)]);
  });

  it('stamps the topics it was collected against', () => {
    expect(record(EMPTY_FEEDBACK, T, v(1), true).topics).toEqual(T);
  });

  it('drops the oldest past the cap, so the query follows current taste', () => {
    let f: ReturnType<typeof record> = EMPTY_FEEDBACK;
    for (let i = 0; i < MAX_PER_CLASS + 5; i++) f = record(f, T, v(i), true);
    expect(f.liked).toHaveLength(MAX_PER_CLASS);
    expect(f.liked[0]).toEqual(v(5));
  });

  it('ignores an empty vector rather than storing a hole', () => {
    expect(count(record(EMPTY_FEEDBACK, T, [], true))).toBe(0);
  });
});

describe('forTopics', () => {
  it('keeps corrections made against the same topics', () => {
    const f = record(EMPTY_FEEDBACK, T, v(1), true);
    expect(forTopics(f, T)).toBe(f);
  });

  it('discards them when the topics change, never reusing them on a new query', () => {
    const f = record(EMPTY_FEEDBACK, T, v(1), true);
    const next = forTopics(f, ['cooking']);
    expect(count(next)).toBe(0);
    expect(next.topics).toEqual(['cooking']);
  });

  it('treats reordered topics as a different set, matching how they are scored', () => {
    const f = record(EMPTY_FEEDBACK, ['a', 'b'], v(1), true);
    expect(count(forTopics(f, ['b', 'a']))).toBe(0);
  });
});
