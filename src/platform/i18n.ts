import browser from 'webextension-polyfill';
import type { Translate } from '../core/messages';

/** The browser picks the locale from its own UI language and falls back to `default_locale`. */
export const translate: Translate = (key, ...substitutions) =>
  browser.i18n.getMessage(key, substitutions.length > 0 ? substitutions : undefined);
