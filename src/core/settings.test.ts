import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SETTINGS,
  isActiveOn,
  overrideFor,
  parseTopics,
  topicsEqual,
  usableBand,
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

describe('usableBand', () => {
  it('passes a normal band through', () => {
    expect(usableBand({ ...DEFAULT_SETTINGS, bandMin: 0.76, bandMax: 0.83 })).toEqual({
      min: 0.76,
      max: 0.83,
    });
  });

  it('rights an inverted band instead of blurring everything', () => {
    expect(usableBand({ ...DEFAULT_SETTINGS, bandMin: 0.9, bandMax: 0.7 })).toEqual({
      min: 0.7,
      max: 0.9,
    });
  });

  it('keeps a collapsed band usable, so the slider still moves', () => {
    const band = usableBand({ ...DEFAULT_SETTINGS, bandMin: 0.8, bandMax: 0.8 });
    expect(band.max).toBeGreaterThan(band.min);
  });
});
