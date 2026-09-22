import type { Settings } from './settings';

/** No spaces between words, or particles glued onto them (Hangul): matched anywhere. */
const UNSPACED =
  /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}\p{Script=Thai}\p{Script=Lao}\p{Script=Khmer}\p{Script=Myanmar}]/u;

/** Latin, fullwidth and ideographic commas, and the Japanese list mark; line breaks too. */
const SEPARATORS = /[,，、،\n]/;

/** One capture group per keyword, aligned with `keywords`, so a match names its keyword. */
interface Matcher {
  pattern: RegExp;
  keywords: string[];
}

const compiled = new WeakMap<readonly string[], Matcher | null>();

/**
 * Literal, never the model: a keyword blurs exactly the posts that contain it.
 * Case and accents are ignored, and a singular also matches its plural.
 */
export function blursAsBlacklisted(settings: Settings, text: string): boolean {
  return blockedKeyword(settings, text) !== undefined;
}

/** The keyword that blocks this post, as the reader wrote it; undefined when none does. */
export function blockedKeyword(settings: Settings, text: string): string | undefined {
  const { blacklist } = settings;
  if (blacklist.length === 0) return undefined;
  let matcher = compiled.get(blacklist);
  if (matcher === undefined) {
    matcher = compile(blacklist);
    compiled.set(blacklist, matcher);
  }
  const match = matcher?.pattern.exec(fold(text));
  if (!match) return undefined;
  const group = match.findIndex((captured, i) => i > 0 && captured !== undefined);
  return matcher?.keywords[group - 1];
}

/** Comma-separated and lowercased, so `Jev` and `jeV` are one keyword; blanks and duplicates dropped. */
export function parseKeywords(raw: string): string[] {
  const seen = new Set<string>();
  for (const part of raw.split(SEPARATORS)) {
    const keyword = part.trim().replace(/\s+/g, ' ').toLowerCase();
    if (keyword !== '') seen.add(keyword);
  }
  return [...seen];
}

export function keywordsToText(keywords: readonly string[]): string {
  return keywords.join(', ');
}

function compile(blacklist: readonly string[]): Matcher | null {
  const keywords = blacklist.filter((k) => fold(k).trim() !== '');
  if (keywords.length === 0) return null;
  const groups = keywords.map((k) => `(${keywordPattern(fold(k).trim())})`);
  return { pattern: new RegExp(groups.join('|'), 'u'), keywords };
}

function keywordPattern(keyword: string): string {
  const literal = (s: string) => escape(s).replace(/\s+/g, '\\s+');
  if (UNSPACED.test(keyword)) return literal(keyword);
  const plural = keyword.endsWith('y')
    ? `${literal(keyword.slice(0, -1))}(?:ys?|ies)`
    : `${literal(keyword)}(?:s|es)?`;
  return `(?<![\\p{L}\\p{N}])${plural}(?![\\p{L}\\p{N}])`;
}

/** Latin-range accents only: stripping every mark turned が into か and emptied Devanagari vowels. */
function fold(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .normalize('NFC')
    .toLowerCase();
}

function escape(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
