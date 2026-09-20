import { hashText } from '../core/cache';
import { classify, type Language } from '../core/language';
import { logger } from '../core/log';
import type { ModelSpec } from '../core/models';
import type { DetectLanguage } from './ports';

const log = logger('language');

/**
 * CLD ships in both browsers behind `i18n`, so there is nothing to bundle and
 * nothing to keep trained. A missing or throwing API returns undefined and the
 * language tiers stand down — the post is judged on its score alone.
 */
export class LanguageCache {
  readonly #known = new Map<string, Language>();
  readonly #inFlight = new Map<string, Promise<Language | undefined>>();

  constructor(
    private readonly detectLanguage: DetectLanguage,
    private readonly limit = 2000,
  ) {}

  get(text: string): Language | undefined {
    return this.#known.get(hashText(text));
  }

  /** A verdict is against one model's language; another model's is not the same. */
  clear(): void {
    this.#known.clear();
  }

  /** Deduped by content: a virtualized feed offers the same post repeatedly. */
  detect(text: string, spec: ModelSpec): Promise<Language | undefined> {
    const key = hashText(text);
    const known = this.#known.get(key);
    if (known !== undefined) return Promise.resolve(known);
    const running = this.#inFlight.get(key);
    if (running) return running;

    const pending = this.#run(text, spec)
      .then((language) => {
        if (language !== undefined) this.#remember(key, language);
        return language;
      })
      .finally(() => this.#inFlight.delete(key));
    this.#inFlight.set(key, pending);
    return pending;
  }

  async #run(text: string, spec: ModelSpec): Promise<Language | undefined> {
    try {
      return classify(await this.detectLanguage(text), spec);
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
