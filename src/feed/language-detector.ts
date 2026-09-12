import browser from 'webextension-polyfill';
import { hashText } from '../core/cache';
import { logger } from '../core/log';
import { classify, type Language } from './language';

const log = logger('language');

/**
 * CLD ships in both browsers behind `i18n`, so there is nothing to bundle and
 * nothing to keep trained. A missing or throwing API returns undefined and the
 * language tiers stand down — the post is judged on its score alone.
 *
 * Split from `language.ts` for the reason `settings-storage.ts` is: the polyfill
 * throws on import outside an extension, and the rules must test in milliseconds.
 */
export class LanguageCache {
  readonly #known = new Map<string, Language>();
  readonly #inFlight = new Map<string, Promise<Language | undefined>>();

  constructor(private readonly limit = 2000) {}

  get(text: string): Language | undefined {
    return this.#known.get(hashText(text));
  }

  /** Deduped by content: a virtualized feed offers the same post repeatedly. */
  detect(text: string): Promise<Language | undefined> {
    const key = hashText(text);
    const known = this.#known.get(key);
    if (known !== undefined) return Promise.resolve(known);
    const running = this.#inFlight.get(key);
    if (running) return running;

    const pending = this.#run(text)
      .then((language) => {
        if (language !== undefined) this.#remember(key, language);
        return language;
      })
      .finally(() => this.#inFlight.delete(key));
    this.#inFlight.set(key, pending);
    return pending;
  }

  async #run(text: string): Promise<Language | undefined> {
    try {
      return classify(await browser.i18n.detectLanguage(text));
    } catch (error) {
      log.warn('detection unavailable, scoring alone from here', {
        reason: error instanceof Error ? error.message : String(error),
      });
      return undefined;
    }
  }

  #remember(key: string, language: Language): void {
    this.#known.delete(key);
    this.#known.set(key, language);
    if (this.#known.size > this.limit) {
      const oldest = this.#known.keys().next();
      if (!oldest.done) this.#known.delete(oldest.value);
    }
  }
}
