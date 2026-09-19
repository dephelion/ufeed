import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SETTINGS,
  isActive,
  needsTopics,
  parseTopics,
  topicsEqual,
  withDefaults,
} from './settings';

const withTopics = { ...DEFAULT_SETTINGS, topics: ['software'] };

describe('isActive', () => {
  it('is inactive with no topics, so a fresh install blurs nothing', () => {
    expect(isActive(DEFAULT_SETTINGS)).toBe(false);
  });

  it('is active once topics exist', () => {
    expect(isActive(withTopics)).toBe(true);
  });

  it('respects the global switch', () => {
    expect(isActive({ ...withTopics, enabled: false })).toBe(false);
  });
});

describe('needsTopics', () => {
  it('speaks up on a fresh install: on, with nothing to do', () => {
    expect(needsTopics(DEFAULT_SETTINGS)).toBe(true);
  });

  it('stays quiet once topics exist', () => {
    expect(needsTopics(withTopics)).toBe(false);
  });

  it('stays quiet when the reader turned it off — that was a choice', () => {
    expect(needsTopics({ ...DEFAULT_SETTINGS, enabled: false })).toBe(false);
  });

  it('never fires at the same time as isActive', () => {
    for (const s of [DEFAULT_SETTINGS, withTopics, { ...withTopics, enabled: false }]) {
      expect(needsTopics(s) && isActive(s)).toBe(false);
    }
  });
});

describe('parseTopics', () => {
  it('splits on lines and trims', () => {
    expect(parseTopics(' tech \n software ')).toEqual(['tech', 'software']);
  });

  it('drops blank lines rather than storing empty topics', () => {
    expect(parseTopics('tech\n\n   \nai')).toEqual(['tech', 'ai']);
  });

  it('drops duplicates', () => {
    expect(parseTopics('tech\ntech')).toEqual(['tech']);
  });

  it('returns nothing for empty input, which leaves filtering off', () => {
    expect(parseTopics('   \n  ')).toEqual([]);
  });
});

describe('topicsEqual', () => {
  it('is true for the same topics in the same order', () => {
    expect(topicsEqual(['a', 'b'], ['a', 'b'])).toBe(true);
  });

  it('is false when order differs, so Apply stays enabled', () => {
    expect(topicsEqual(['a', 'b'], ['b', 'a'])).toBe(false);
  });

  it('is false on different lengths', () => {
    expect(topicsEqual(['a'], ['a', 'b'])).toBe(false);
  });
});

describe('strictness read back from storage', () => {
  it('keeps a value that is a step on the scale', () => {
    expect(withDefaults({ strictness: 8 }).strictness).toBe(8);
  });

  it('falls back rather than trusting a 0..1 position from the old slider', () => {
    expect(withDefaults({ strictness: 0.35 }).strictness).toBe(
      DEFAULT_SETTINGS.strictness,
    );
  });

  it('pulls an off-scale step onto the scale', () => {
    expect(withDefaults({ strictness: 99 }).strictness).toBe(10);
    expect(withDefaults({ strictness: -4 }).strictness).toBe(0);
  });

  it('falls back on a value that is not a number at all', () => {
    expect(withDefaults({ strictness: 'loose' as unknown as number }).strictness).toBe(
      DEFAULT_SETTINGS.strictness,
    );
  });

  it('keeps zero, which is a real setting and not a missing one', () => {
    expect(withDefaults({ strictness: 0 }).strictness).toBe(0);
  });
});

describe('a settings value of the wrong type', () => {
  it('falls back to the default, as a hand-edited backup can hold anything', () => {
    const read = withDefaults({ topics: 'rust', enabled: 'yes' } as never);
    expect(read.topics).toEqual([]);
    expect(read.enabled).toBe(true);
  });

  it('drops a topic list holding anything but strings', () => {
    expect(withDefaults({ topics: ['rust', null] } as never).topics).toEqual([]);
  });

  it('keeps every field that has the right type', () => {
    const read = withDefaults({ topics: ['rust'], showScores: true });
    expect(read.topics).toEqual(['rust']);
    expect(read.showScores).toBe(true);
  });
});
