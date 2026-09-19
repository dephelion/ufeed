import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from './settings';
import { blursAsOtherLanguage, classify, type Detection } from './language';

const cld = (isReliable: boolean, ...languages: [string, number][]): Detection => ({
  isReliable,
  languages: languages.map(([language, percentage]) => ({ language, percentage })),
});

describe('classify', () => {
  it('places English as the language the model reads', () => {
    expect(classify(cld(true, ['en', 99]))).toBe('match');
  });

  it('places a regional variant by its base language', () => {
    expect(classify(cld(true, ['en-GB', 97]))).toBe('match');
  });

  it('places Spanish as one it does not', () => {
    expect(classify(cld(true, ['es', 96]))).toBe('other');
  });

  it('takes the largest share, not the first listed', () => {
    expect(classify(cld(true, ['en', 22], ['es', 78]))).toBe('other');
  });

  it('refuses to call a post CLD itself could not place', () => {
    expect(classify(cld(false, ['es', 90]))).toBe('unclear');
  });

  it('refuses a post split between two languages', () => {
    expect(classify(cld(true, ['en', 55], ['es', 45]))).toBe('unclear');
  });

  it('ignores the unknown bucket rather than reading it as a language', () => {
    expect(classify(cld(true, ['und', 80], ['es', 20]))).toBe('unclear');
  });

  it('refuses a result carrying no language at all', () => {
    expect(classify(cld(true))).toBe('unclear');
  });
});

describe('blursAsOtherLanguage', () => {
  const on = { ...DEFAULT_SETTINGS, blurOtherLanguages: true };

  it('blurs a post in another language', () => {
    expect(blursAsOtherLanguage(on, 'other')).toBe(true);
  });

  it('leaves a readable post alone', () => {
    expect(blursAsOtherLanguage(on, 'match')).toBe(false);
  });

  it('never blurs on an unplaceable post — the media rule owns that case', () => {
    expect(blursAsOtherLanguage(on, 'unclear')).toBe(false);
  });

  it('fails open when nothing was detected', () => {
    expect(blursAsOtherLanguage(on, undefined)).toBe(false);
  });

  it('does nothing while the setting is off', () => {
    const off = { ...DEFAULT_SETTINGS, blurOtherLanguages: false };
    expect(blursAsOtherLanguage(off, 'other')).toBe(false);
  });

  it('is on by default', () => {
    expect(DEFAULT_SETTINGS.blurOtherLanguages).toBe(true);
  });
});
