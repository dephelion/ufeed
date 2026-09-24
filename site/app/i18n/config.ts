import i18next from 'i18next';
import { resources } from './resources';

export const i18n = i18next.createInstance();
void i18n.init({
  resources,
  lng: 'en',
  fallbackLng: 'en',
  supportedLngs: ['en', 'es'],
  interpolation: { escapeValue: false },
  initAsync: false,
});

export function translate(locale: 'en' | 'es') {
  return i18n.getFixedT(locale);
}
