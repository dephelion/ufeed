/**
 * The languages the popup speaks, one per folder of public/_locales. A name is
 * written in its own language and never translated, so a reader who cannot read
 * the current one can still find theirs.
 */
export const LANGUAGES = [
  { code: 'en', flag: '🇬🇧', name: 'English' },
  { code: 'es', flag: '🇪🇸', name: 'Español' },
  { code: 'de', flag: '🇩🇪', name: 'Deutsch' },
  { code: 'fr', flag: '🇫🇷', name: 'Français' },
  { code: 'pt_BR', flag: '🇧🇷', name: 'Português (Brasil)' },
  { code: 'ja', flag: '🇯🇵', name: '日本語' },
  { code: 'zh_CN', flag: '🇨🇳', name: '简体中文' },
  { code: 'zh_TW', flag: '🇹🇼', name: '繁體中文' },
] as const;

export type LanguageCode = (typeof LANGUAGES)[number]['code'];

/** `auto` follows the browser, which is what a reader who never chose gets. */
export type LanguageSetting = 'auto' | LanguageCode;

export const DEFAULT_LANGUAGE: LanguageCode = 'en';

export function isLanguageCode(value: unknown): value is LanguageCode {
  return LANGUAGES.some((language) => language.code === value);
}

/** A tag the browser reports (`es-MX`, `pt-BR`) as a language we have, else English. */
export function languageForBrowser(tag: string): LanguageCode {
  const code = tag.replace('-', '_');
  if (isLanguageCode(code)) return code;
  const base = code.split('_')[0];
  return isLanguageCode(base) ? base : DEFAULT_LANGUAGE;
}

export function resolveLanguage(
  setting: LanguageSetting,
  browserTag: string,
): LanguageCode {
  return setting === 'auto' ? languageForBrowser(browserTag) : setting;
}
