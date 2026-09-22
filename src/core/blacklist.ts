import type { Settings } from './settings';

/** Scripts written without spaces between words: a keyword there is matched anywhere. */
const UNSPACED = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u;

const compiled = new WeakMap<readonly string[], RegExp | null>();

/**
 * Literal, never the model: a keyword blurs exactly the posts that contain it.
 * Case and accents are ignored, and a singular also matches its plural.
 */
export function blursAsBlacklisted(settings: Settings, text: string): boolean {
  const { blacklist } = settings;
  if (blacklist.length === 0) return false;
  let pattern = compiled.get(blacklist);
  if (pattern === undefined) {
    pattern = compile(blacklist);
    compiled.set(blacklist, pattern);
  }
  return pattern?.test(fold(text)) ?? false;
}

function compile(keywords: readonly string[]): RegExp | null {
  const parts = keywords.map((k) => fold(k).trim()).filter((k) => k !== '');
  if (parts.length === 0) return null;
  return new RegExp(parts.map(keywordPattern).join('|'), 'u');
}

function keywordPattern(keyword: string): string {
  const literal = (s: string) => escape(s).replace(/\s+/g, '\\s+');
  if (UNSPACED.test(keyword)) return literal(keyword);
  const plural = keyword.endsWith('y')
    ? `${literal(keyword.slice(0, -1))}(?:ys?|ies)`
    : `${literal(keyword)}(?:s|es)?`;
  return `(?<![\\p{L}\\p{N}])${plural}(?![\\p{L}\\p{N}])`;
}

function fold(text: string): string {
  return text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

function escape(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
