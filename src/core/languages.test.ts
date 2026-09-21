import { describe, expect, it } from 'vitest';
import { languageForBrowser, resolveLanguage } from './languages';

describe('languageForBrowser', () => {
  it.each([
    ['en-US', 'en'],
    ['es-MX', 'es'],
    ['ja', 'ja'],
    ['pt-BR', 'pt_BR'],
    ['zh-CN', 'zh_CN'],
    ['zh-TW', 'zh_TW'],
  ])('reads %s as %s', (tag, expected) => {
    expect(languageForBrowser(tag)).toBe(expected);
  });

  it('gives English for a language it does not have', () => {
    for (const tag of ['it-IT', 'pt-PT', 'zh-HK', '']) {
      expect(languageForBrowser(tag)).toBe('en');
    }
  });
});

describe('resolveLanguage', () => {
  it('follows the browser until the reader chose one', () => {
    expect(resolveLanguage('auto', 'fr-FR')).toBe('fr');
  });

  it('keeps the reader’s choice over the browser', () => {
    expect(resolveLanguage('de', 'fr-FR')).toBe('de');
  });
});
