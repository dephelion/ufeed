import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SETTINGS,
  isActiveOn,
  overrideFor,
  parseTopics,
  topicsEqual,
  withDefaults,
} from './settings';

const withTopics = { ...DEFAULT_SETTINGS, topics: ['software'] };

describe('isActiveOn', () => {
  it('is inactive with no topics, so a fresh install blurs nothing', () => {
    expect(isActiveOn(DEFAULT_SETTINGS, 'x.com')).toBe(false);
  });

  it('is active once topics exist', () => {
    expect(isActiveOn(withTopics, 'x.com')).toBe(true);
  });

  it('respects the global switch', () => {
    expect(isActiveOn({ ...withTopics, enabled: false }, 'x.com')).toBe(false);
  });

  it('respects a per-host opt-out', () => {
    expect(isActiveOn({ ...withTopics, disabledHosts: ['x.com'] }, 'x.com')).toBe(false);
  });
});

describe('overrideFor', () => {
  it('returns nothing when no override matches', () => {
    expect(overrideFor(withTopics, 'a post about cats')).toBeUndefined();
  });

  it('keeps on an alwaysKeep term, case-insensitively', () => {
    const s = { ...withTopics, alwaysKeep: ['RustLang'] };
    expect(overrideFor(s, 'shipping rustlang today')).toBe('keep');
  });

  it('blurs on an alwaysBlur term', () => {
    const s = { ...withTopics, alwaysBlur: ['crypto'] };
    expect(overrideFor(s, 'my crypto portfolio')).toBe('blur');
  });

  it('prefers keep when both match', () => {
    const s = { ...withTopics, alwaysKeep: ['rust'], alwaysBlur: ['crypto'] };
    expect(overrideFor(s, 'rust and crypto')).toBe('keep');
  });

  it('ignores blank terms rather than matching everything', () => {
    const s = { ...withTopics, alwaysBlur: ['', '   '] };
    expect(overrideFor(s, 'any text at all')).toBeUndefined();
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
