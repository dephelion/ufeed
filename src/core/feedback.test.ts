import { describe, expect, it } from 'vitest';
import {
  EMPTY_FEEDBACK,
  MAX_PER_CLASS,
  correctionsFor,
  count,
  countFor,
  forTopics,
  record,
} from './feedback';

const v = (n: number) => [n, n, n];

describe('record', () => {
  it('keeps a liked and a disliked correction apart', () => {
    let f = record(EMPTY_FEEDBACK, 'software', v(1), true);
    f = record(f, 'software', v(2), false);
    expect(correctionsFor(f, 'software').liked).toEqual([v(1)]);
    expect(correctionsFor(f, 'software').disliked).toEqual([v(2)]);
  });

  it('files corrections under the line they were given against', () => {
    let f = record(EMPTY_FEEDBACK, 'software', v(1), true);
    f = record(f, 'video games', v(2), true);
    expect(countFor(f, 'software')).toBe(1);
    expect(countFor(f, 'video games')).toBe(1);
  });

  it('drops the oldest past the cap, so the query follows current taste', () => {
    let f = EMPTY_FEEDBACK;
    for (let i = 0; i < MAX_PER_CLASS + 5; i++) f = record(f, 'software', v(i), true);
    expect(correctionsFor(f, 'software').liked).toHaveLength(MAX_PER_CLASS);
    expect(correctionsFor(f, 'software').liked[0]).toEqual(v(5));
  });

  it('ignores an empty vector rather than storing a hole', () => {
    expect(count(record(EMPTY_FEEDBACK, 'software', [], true))).toBe(0);
  });

  it('ignores a correction with no topic to attach it to', () => {
    expect(count(record(EMPTY_FEEDBACK, '', v(1), true))).toBe(0);
  });
});

describe('forTopics', () => {
  const two = record(record(EMPTY_FEEDBACK, 'software', v(1), true), 'games', v(2), true);

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
