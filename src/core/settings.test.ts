import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, isActiveOn, overrideFor } from './settings';

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
