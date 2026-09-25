import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from './settings';
import { MODELS, modelFor } from './models';
import {
  blursAsOtherLanguage,
  classify,
  gatesLanguage,
  type Detection,
} from './language';

const spec = modelFor('e5-small');

const cld = (isReliable: boolean, ...languages: [string, number][]): Detection => ({
  isReliable,
  languages: languages.map(([language, percentage]) => ({ language, percentage })),
});

describe('classify', () => {
  it('places English as the language the model reads', () => {
    expect(classify(cld(true, ['en', 99]), spec)).toBe('match');
  });

  it('places a regional variant by its base language', () => {
    expect(classify(cld(true, ['en-GB', 97]), spec)).toBe('match');
  });

  it('places Spanish as one it does not', () => {
    expect(classify(cld(true, ['es', 96]), spec)).toBe('other');
  });

  it('takes the largest share, not the first listed', () => {
    expect(classify(cld(true, ['en', 22], ['es', 78]), spec)).toBe('other');
  });

  it('refuses to call a post CLD itself could not place', () => {
    expect(classify(cld(false, ['es', 90]), spec)).toBe('unclear');
  });

  it('refuses a post split between two languages', () => {
    expect(classify(cld(true, ['en', 55], ['es', 45]), spec)).toBe('unclear');
  });

  it('ignores the unknown bucket rather than reading it as a language', () => {
    expect(classify(cld(true, ['und', 80], ['es', 20]), spec)).toBe('unclear');
  });

  it('refuses a result carrying no language at all', () => {
    expect(classify(cld(true), spec)).toBe('unclear');
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

describe('a model that reads every language', () => {
  const multi = MODELS.gemma;

  it('places any post as readable, so nothing blurs as foreign', () => {
    expect(classify(cld(true, ['es', 99]), multi)).toBe('match');
    expect(classify(cld(false), multi)).toBe('match');
  });

  it('gates nothing, however the checkbox is left', () => {
    const on = { ...DEFAULT_SETTINGS, blurOtherLanguages: true };
    expect(gatesLanguage(on, spec)).toBe(true);
    expect(gatesLanguage(on, multi)).toBe(false);
  });

  it("keeps the reader's choice stored for a switch back", () => {
    const off = { ...DEFAULT_SETTINGS, blurOtherLanguages: false };
    expect(gatesLanguage(off, spec)).toBe(false);
  });
});
