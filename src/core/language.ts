import { MODEL } from './models';

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
