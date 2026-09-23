import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SETTINGS,
  isActive,
  needsTopics,
  onlyLanguageChanged,
  parseTopics,
  topicsEqual,
  withDefaults,
  type Settings,
} from './settings';

const withTopics = { ...DEFAULT_SETTINGS, topics: ['software'] };
const withBlacklist = { ...DEFAULT_SETTINGS, blacklist: ['crypto'] };

describe('isActive', () => {
  it('is inactive with no topics, so a fresh install blurs nothing', () => {
    expect(isActive(DEFAULT_SETTINGS, true)).toBe(false);
  });

  it('is active once topics exist', () => {
    expect(isActive(withTopics, true)).toBe(true);
  });

  it('is active with only a blacklist', () => {
    expect(isActive(withBlacklist, true)).toBe(true);
    expect(isActive(withBlacklist, false)).toBe(false);
  });

  it("respects the tab's switch", () => {
    expect(isActive(withTopics, false)).toBe(false);
  });
});

describe('needsTopics', () => {
  it('speaks up on a fresh install: on, with nothing to do', () => {
    expect(needsTopics(DEFAULT_SETTINGS, true)).toBe(true);
  });

  it('stays quiet once topics exist', () => {
    expect(needsTopics(withTopics, true)).toBe(false);
  });

  it('stays quiet when a blacklist is the only filter', () => {
    expect(needsTopics(withBlacklist, true)).toBe(false);
  });

  it('stays quiet when the reader turned the tab off — that was a choice', () => {
    expect(needsTopics(DEFAULT_SETTINGS, false)).toBe(false);
  });

  it('never fires at the same time as isActive', () => {
    for (const s of [DEFAULT_SETTINGS, withTopics, withBlacklist]) {
      for (const on of [true, false]) {
        expect(needsTopics(s, on) && isActive(s, on)).toBe(false);
      }
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
    const read = withDefaults({ topics: 'rust', showScores: 'yes' } as never);
    expect(read.topics).toEqual([]);
    expect(read.showScores).toBe(false);
  });

  it('drops the old global switch, so no install is left stuck off', () => {
    expect(withDefaults({ enabled: false } as never)).toEqual(DEFAULT_SETTINGS);
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

describe('language', () => {
  it('follows the browser until the reader picks one', () => {
    expect(DEFAULT_SETTINGS.language).toBe('auto');
  });

  it('keeps a language this build ships', () => {
    expect(withDefaults({ language: 'de' }).language).toBe('de');
  });

  it('falls back to the browser for one it does not, as a hand-edited backup may hold', () => {
    const unknown = 'klingon' as Settings['language'];
    expect(withDefaults({ language: unknown }).language).toBe('auto');
  });
});

describe('onlyLanguageChanged', () => {
  it('is true when the language is all that differs', () => {
    expect(onlyLanguageChanged(withTopics, { ...withTopics, language: 'ja' })).toBe(true);
  });

  it('is false when anything else changed with it', () => {
    const after = { ...withTopics, language: 'ja' as const };
    expect(onlyLanguageChanged(withTopics, { ...after, strictness: 2 })).toBe(false);
    expect(onlyLanguageChanged(withTopics, { ...after, topics: ['baking'] })).toBe(false);
    expect(onlyLanguageChanged(withTopics, { ...after, blacklist: ['crypto'] })).toBe(
      false,
    );
  });

  it('is false when the language did not change at all', () => {
    expect(onlyLanguageChanged(withTopics, { ...withTopics })).toBe(false);
  });
});
