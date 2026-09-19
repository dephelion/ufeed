import browser from 'webextension-polyfill';
import { hashText } from '../core/cache';
import { logger } from '../core/log';
import { MODEL } from '../ml/models';

const log = logger('language');

/**
 * `unclear` is CLD's own verdict — it read the text and could not place it —
 * while `undefined` from the detector means it never ran, which decides nothing.
 */
export type Language = 'match' | 'other' | 'unclear';

/** Shape of `i18n.detectLanguage`, narrowed to what the verdict needs. */
export interface Detection {
  isReliable: boolean;
  languages: readonly { language: string; percentage: number }[];
}

/**
 * A feed post mixing two languages comes back reliable with the top language at
 * a bare plurality; the model reads one of them at best, so it counts as unread.
 */
const MIN_SHARE = 60;

export function classify(result: Detection): Language {
  if (!result.isReliable) return 'unclear';
  const top = [...result.languages]
    .filter((l) => l.language !== 'und')
    .sort((a, b) => b.percentage - a.percentage)[0];
  if (!top || top.percentage < MIN_SHARE) return 'unclear';
  return top.language.split('-')[0] === MODEL.language ? 'match' : 'other';
}

/**
 * Engine-independent by design, like the media rule: the post is blurred because
 * the model cannot read its language, never because scoring failed.
 */
export function blursAsOtherLanguage(
  settings: { blurOtherLanguages: boolean },
  language: Language | undefined,
): boolean {
  return settings.blurOtherLanguages && language === 'other';
}

/**
 * CLD ships in both browsers behind `i18n`, so there is nothing to bundle and
 * nothing to keep trained. A missing or throwing API returns undefined and the
 * language tiers stand down — the post is judged on its score alone.
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
