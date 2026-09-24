import en from './en.json';
import es from './es.json';
import zhCN from './zh-CN.json';
import zhTW from './zh-TW.json';
import fr from './fr.json';
import de from './de.json';
import ja from './ja.json';
import ptBR from './pt-BR.json';

export const resources = {
  en: { translation: en },
  es: { translation: es },
  'zh-CN': { translation: zhCN },
  'zh-TW': { translation: zhTW },
  fr: { translation: fr },
  de: { translation: de },
  ja: { translation: ja },
  'pt-BR': { translation: ptBR },
};

export const locales = ['en', 'zh-CN', 'zh-TW', 'fr', 'de', 'ja', 'pt-BR', 'es'] as const;
export type Locale = (typeof locales)[number];

export function isLocale(locale: string): locale is Locale {
  return locales.some((supported) => supported === locale);
}

export function browserLocale(languages: readonly string[]): Locale {
  for (const rawLanguage of languages) {
    const language = rawLanguage.toLowerCase();
    const exact = locales.find((locale) => locale.toLowerCase() === language);
    if (exact) return exact;
    if (language.startsWith('zh')) {
      if (/tw|hk|mo|hant/.test(language)) return 'zh-TW';
      return 'zh-CN';
    }
    if (language.startsWith('pt')) return 'pt-BR';
    const base = language.split('-')[0];
    const match = locales.find((locale) => locale.toLowerCase() === base);
    if (match) return match;
  }
  return 'en';
}
