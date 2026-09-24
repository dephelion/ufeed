import i18next from 'i18next';
import { locales, resources, type Locale } from './resources';

export const i18n = i18next.createInstance();
void i18n.init({
  resources,
  lng: 'en',
  fallbackLng: 'en',
  supportedLngs: [...locales],
  interpolation: { escapeValue: false },
  initAsync: false,
});

export function translate(locale: Locale) {
  return i18n.getFixedT(locale);
}
