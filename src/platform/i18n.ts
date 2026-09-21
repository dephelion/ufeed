import browser from 'webextension-polyfill';
import { logger } from '../core/log';
import type { LanguageCode } from '../core/languages';
import { createTranslator, type Translate } from '../core/messages';

const log = logger('i18n');

/** The browser picks the locale from its own UI language and falls back to `default_locale`. */
export const translate: Translate = (key, ...substitutions) =>
  browser.i18n.getMessage(key, substitutions.length > 0 ? substitutions : undefined);

/**
 * `getMessage` cannot be told a language, so a reader's own pick has to read the
 * catalog itself. Falls back to the browser's language rather than show nothing.
 */
export async function loadTranslator(language: LanguageCode): Promise<Translate> {
  try {
    const response = await fetch(
      browser.runtime.getURL(`/_locales/${language}/messages.json`),
    );
    return createTranslator(await response.json());
  } catch (error) {
    log.warn('language not loaded, using the browser language', {
      language,
      reason: error instanceof Error ? error.message : String(error),
    });
    return translate;
  }
}
